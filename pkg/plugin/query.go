package plugin

import (
	"fmt"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/utils"
)

const (
	instantQueryPath    = "/select/logsql/query"
	tailQueryPath       = "/select/logsql/tail"
	statsQueryPath      = "/select/logsql/stats_query"
	statsQueryRangePath = "/select/logsql/stats_query_range"
	defaultMaxLines     = 1000
	legendFormatAuto    = "__auto"
	metricsName         = "__name__"
	defaultInterval     = 15 * time.Second
)

// Query represents backend query object
type Query struct {
	RefID           string `json:"refId"`
	Expr            string `json:"expr"`
	LegendFormat    string `json:"legendFormat"`
	MaxLines        int    `json:"maxLines"`
	TimeRange       TimeRange
	IntervalMs      int64  `json:"intervalMs"`
	Interval        string `json:"interval"`
	TimeInterval    string `json:"timeInterval"`
	StatsQueryRange bool   `json:"statsQueryRange"`
	StatsQuery      bool   `json:"statsQuery"`
	MaxDataPoints   int64
	url             *url.URL
}

// TimeRange represents time range backend object
type TimeRange struct {
	From time.Time
	To   time.Time
}

// GetQueryURL calculates step and clear expression from template variables,
// and after builds query url depends on query type
func (q *Query) getQueryURL(rawURL string, queryParams string) (string, error) {
	if rawURL == "" {
		return "", fmt.Errorf("url can't be blank")
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("failed to parse datasource url: %s", err)
	}
	params, err := url.ParseQuery(queryParams)
	if err != nil {
		return "", fmt.Errorf("failed to parse query params: %s", err.Error())
	}

	q.url = u

	if q.StatsQuery {
		return q.statsQueryURL(params), nil
	}
	if q.StatsQueryRange {
		minInterval, err := q.calculateMinInterval()
		if err != nil {
			return "", fmt.Errorf("failed to calculate minimal interval: %w", err)
		}
		return q.statsQueryRangeURL(params, minInterval), nil
	}

	return q.queryInstantURL(params), nil
}

// queryInstantURL prepare query url for instant query
func (q *Query) queryTailURL(rawURL string, queryParams string) (string, error) {
	if rawURL == "" {
		return "", fmt.Errorf("url can't be blank")
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("failed to parse datasource url: %s", err)
	}
	params, err := url.ParseQuery(queryParams)
	if err != nil {
		return "", fmt.Errorf("failed to parse query params: %s", err.Error())
	}

	q.url = u

	q.url.Path = path.Join(q.url.Path, tailQueryPath)
	values := q.url.Query()

	for k, vl := range params {
		for _, v := range vl {
			values.Add(k, v)
		}
	}

	q.Expr = utils.ReplaceTemplateVariable(q.Expr, q.IntervalMs)
	values.Set("query", q.Expr)

	q.url.RawQuery = values.Encode()
	return q.url.String(), nil
}

// queryInstantURL prepare query url for instant query
func (q *Query) queryInstantURL(queryParams url.Values) string {
	q.url.Path = path.Join(q.url.Path, instantQueryPath)
	values := q.url.Query()

	for k, vl := range queryParams {
		for _, v := range vl {
			values.Add(k, v)
		}
	}

	if q.MaxLines <= 0 {
		q.MaxLines = defaultMaxLines
	}

	now := time.Now()
	if q.TimeRange.From.IsZero() {
		q.TimeRange.From = now.Add(-time.Minute * 5)
	}
	if q.TimeRange.To.IsZero() {
		q.TimeRange.To = now
	}

	q.Expr = utils.ReplaceTemplateVariable(q.Expr, q.IntervalMs)
	values.Set("query", q.Expr)
	values.Set("limit", strconv.Itoa(q.MaxLines))
	values.Set("start", strconv.FormatInt(q.TimeRange.From.Unix(), 10))
	values.Set("end", strconv.FormatInt(q.TimeRange.To.Unix(), 10))

	q.url.RawQuery = values.Encode()
	return q.url.String()
}

// statsQueryURL prepare query url for querying log stats
func (q *Query) statsQueryURL(queryParams url.Values) string {
	q.url.Path = path.Join(q.url.Path, statsQueryPath)
	values := q.url.Query()

	for k, vl := range queryParams {
		for _, v := range vl {
			values.Add(k, v)
		}
	}

	now := time.Now()
	if q.TimeRange.From.IsZero() {
		q.TimeRange.From = now.Add(-time.Minute * 5)
	}

	q.Expr = utils.ReplaceTemplateVariable(q.Expr, q.IntervalMs)
	values.Set("query", q.Expr)
	values.Set("time", strconv.FormatInt(q.TimeRange.To.Unix(), 10))

	q.url.RawQuery = values.Encode()
	return q.url.String()
}

// statsQueryRangeURL prepare query url for querying log range stats
func (q *Query) statsQueryRangeURL(queryParams url.Values, minInterval time.Duration) string {
	q.url.Path = path.Join(q.url.Path, statsQueryRangePath)
	values := q.url.Query()

	for k, vl := range queryParams {
		for _, v := range vl {
			values.Add(k, v)
		}
	}

	if q.MaxLines <= 0 {
		q.MaxLines = defaultMaxLines
	}

	from := q.TimeRange.From
	to := q.TimeRange.To

	now := time.Now()
	if q.TimeRange.From.IsZero() {
		q.TimeRange.From = now.Add(-time.Minute * 5)
	}
	if q.TimeRange.To.IsZero() {
		q.TimeRange.To = now
	}

	q.Expr = utils.ReplaceTemplateVariable(q.Expr, q.IntervalMs)
	step := utils.CalculateStep(minInterval, from, to, q.MaxDataPoints)

	values.Set("query", q.Expr)
	values.Set("start", strconv.FormatInt(q.TimeRange.From.Unix(), 10))
	values.Set("end", strconv.FormatInt(q.TimeRange.To.Unix(), 10))
	values.Set("step", step.String())

	q.url.RawQuery = values.Encode()
	return q.url.String()
}

func (q *Query) addMetadataToMultiFrame(frame *data.Frame) {
	if len(frame.Fields) < 2 {
		return
	}

	customName := q.parseLegend(frame.Fields[1].Labels)
	if customName != "" {
		frame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: customName}
	}

	frame.Name = customName
}

var legendReplacer = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)

func (q *Query) parseLegend(labels data.Labels) string {

	switch {
	case q.LegendFormat == legendFormatAuto:
		return q.Expr
	case q.LegendFormat != "":
		result := legendReplacer.ReplaceAllStringFunc(q.LegendFormat, func(in string) string {
			labelName := strings.Replace(in, "{{", "", 1)
			labelName = strings.Replace(labelName, "}}", "", 1)
			labelName = strings.TrimSpace(labelName)
			if val, ok := labels[labelName]; ok {
				return val
			}
			return ""
		})
		if result == "" {
			return q.Expr
		}
		return result
	default:
		// If legend is empty brackets, use query expression
		legend := labelsToString(labels)
		if legend == "{}" {
			return q.Expr
		}
		return legend
	}
}

func labelsToString(labels data.Labels) string {
	if labels == nil {
		return "{}"
	}

	var labelStrings []string
	for label, value := range labels {
		if label == metricsName {
			continue
		}
		labelStrings = append(labelStrings, fmt.Sprintf("%s=%q", label, value))
	}

	var metricName string
	mn, ok := labels[metricsName]
	if ok {
		metricName = mn
	}

	if len(labelStrings) < 1 {
		return metricName
	}

	sort.Strings(labelStrings)
	lbs := strings.Join(labelStrings, ",")

	return fmt.Sprintf("%s{%s}", metricName, lbs)
}

// calculateMinInterval tries to calculate interval from requested params
// in duration representation or return error if
func (q *Query) calculateMinInterval() (time.Duration, error) {
	if utils.WithIntervalVariable(q.Interval) {
		q.Interval = ""
	}
	return utils.GetIntervalFrom(q.TimeInterval, q.Interval, q.IntervalMs, defaultInterval)
}
