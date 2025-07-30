package utils

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/VictoriaMetrics/metricsql"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
)

const (
	varInterval   = "$__interval"
	varIntervalMs = "$__interval_ms"
	varRange      = "$__range"

	timeField = "_time"

	nsecsPerHour   = 3600 * 1e9
	nsecsPerMinute = 60 * 1e9
)

var (
	defaultResolution int64 = 1500
	year                    = time.Hour * 24 * 365
	day                     = time.Hour * 24
)

const (
	// These values prevent from overflow when storing msec-precision time in int64.
	minTimeNsecs = 0 // use 0 instead of `int64(-1<<63) / 1e6` because the storage engine doesn't actually support negative time
	maxTimeNsecs = int64(1<<63 - 1)
	maxTimeMsecs = maxTimeNsecs / 1e6
)

// GetTime  returns time from the given string.
func GetTime(s string) (time.Time, error) {
	if nsecs, ok := TryParseTimestampRFC3339Nano(s); ok {
		if nsecs < minTimeNsecs {
			nsecs = 0
		}
		if nsecs > maxTimeNsecs {
			nsecs = maxTimeNsecs
		}
		return time.Unix(0, nsecs).UTC(), nil
	}

	secs, err := ParseTime(s)
	if err != nil {
		return time.Time{}, fmt.Errorf("cannot parse %s: %w", s, err)
	}
	msecs := int64(secs * 1e3)
	if msecs < minTimeNsecs {
		msecs = 0
	}
	if msecs > maxTimeMsecs {
		msecs = maxTimeMsecs
	}

	return time.Unix(0, msecs*int64(time.Millisecond)).UTC(), nil
}

// ParseTime parses time s in different formats.
//
// See https://docs.victoriametrics.com/Single-server-VictoriaMetrics.html#timestamp-formats
//
// It returns unix timestamp in seconds.
func ParseTime(s string) (float64, error) {
	currentTimestamp := float64(time.Now().UnixNano()) / 1e9
	return ParseTimeAt(s, currentTimestamp)
}

const (
	// time.UnixNano can only store maxInt64, which is 2262
	maxValidYear = 2262
	minValidYear = 1970
)

// ParseTimeAt parses time s in different formats, assuming the given currentTimestamp.
//
// See https://docs.victoriametrics.com/Single-server-VictoriaMetrics.html#timestamp-formats
//
// It returns unix timestamp in seconds.
func ParseTimeAt(s string, currentTimestamp float64) (float64, error) {
	if s == "now" {
		return currentTimestamp, nil
	}
	sOrig := s
	tzOffset := float64(0)
	if len(sOrig) > 6 {
		// Try parsing timezone offset
		tz := sOrig[len(sOrig)-6:]
		if (tz[0] == '-' || tz[0] == '+') && tz[3] == ':' {
			isPlus := tz[0] == '+'
			hour, err := strconv.ParseUint(tz[1:3], 10, 64)
			if err != nil {
				return 0, fmt.Errorf("cannot parse hour from timezone offset %q: %w", tz, err)
			}
			minute, err := strconv.ParseUint(tz[4:], 10, 64)
			if err != nil {
				return 0, fmt.Errorf("cannot parse minute from timezone offset %q: %w", tz, err)
			}
			tzOffset = float64(hour*3600 + minute*60)
			if isPlus {
				tzOffset = -tzOffset
			}
			s = sOrig[:len(sOrig)-6]
		}
	}
	s = strings.TrimSuffix(s, "Z")
	if len(s) > 0 && (s[len(s)-1] > '9' || s[0] == '-') || strings.HasPrefix(s, "now") {
		// Parse duration relative to the current time
		s = strings.TrimPrefix(s, "now")
		d, err := ParseDuration(s)
		if err != nil {
			return 0, err
		}
		if d > 0 {
			d = -d
		}
		return currentTimestamp + float64(d)/1e9, nil
	}
	if len(s) == 4 {
		// Parse YYYY
		t, err := time.Parse("2006", s)
		if err != nil {
			return 0, err
		}
		y := t.Year()
		if y > maxValidYear || y < minValidYear {
			return 0, fmt.Errorf("cannot parse year from %q: year must in range [%d, %d]", s, minValidYear, maxValidYear)
		}
		return tzOffset + float64(t.UnixNano())/1e9, nil
	}
	if !strings.Contains(sOrig, "-") {
		// Parse the timestamp in seconds or in milliseconds
		ts, err := strconv.ParseFloat(sOrig, 64)
		if err != nil {
			return 0, err
		}
		if ts >= (1 << 32) {
			// The timestamp is in milliseconds. Convert it to seconds.
			ts /= 1000
		}
		return ts, nil
	}
	if len(s) == 7 {
		// Parse YYYY-MM
		t, err := time.Parse("2006-01", s)
		if err != nil {
			return 0, err
		}
		return tzOffset + float64(t.UnixNano())/1e9, nil
	}
	if len(s) == 10 {
		// Parse YYYY-MM-DD
		t, err := time.Parse("2006-01-02", s)
		if err != nil {
			return 0, err
		}
		return tzOffset + float64(t.UnixNano())/1e9, nil
	}
	if len(s) == 13 {
		// Parse YYYY-MM-DDTHH
		t, err := time.Parse("2006-01-02T15", s)
		if err != nil {
			return 0, err
		}
		return tzOffset + float64(t.UnixNano())/1e9, nil
	}
	if len(s) == 16 {
		// Parse YYYY-MM-DDTHH:MM
		t, err := time.Parse("2006-01-02T15:04", s)
		if err != nil {
			return 0, err
		}
		return tzOffset + float64(t.UnixNano())/1e9, nil
	}
	if len(s) == 19 {
		// Parse YYYY-MM-DDTHH:MM:SS
		t, err := time.Parse("2006-01-02T15:04:05", s)
		if err != nil {
			return 0, err
		}
		return tzOffset + float64(t.UnixNano())/1e9, nil
	}
	// Parse RFC3339
	t, err := time.Parse(time.RFC3339, sOrig)
	if err != nil {
		return 0, err
	}
	return float64(t.UnixNano()) / 1e9, nil
}

// ParseDuration parses duration string in Prometheus format
func ParseDuration(s string) (time.Duration, error) {
	ms, err := metricsql.DurationValue(s, 0)
	if err != nil {
		return 0, err
	}
	return time.Duration(ms) * time.Millisecond, nil
}

// TryParseTimestampRFC3339Nano parses s as RFC3339 with optional nanoseconds part and timezone offset and returns unix timestamp in nanoseconds.
//
// If s doesn't contain timezone offset, then the local timezone is used.
//
// The returned timestamp can be negative if s is smaller than 1970 year.x
func TryParseTimestampRFC3339Nano(s string) (int64, bool) {
	if len(s) < len("2006-01-02T15:04:05") {
		return 0, false
	}

	secs, ok, tail := tryParseTimestampSecs(s)
	if !ok {
		return 0, false
	}
	s = tail
	nsecs := secs * 1e9

	// Parse timezone offset
	offsetNsecs, prefix, ok := parseTimezoneOffset(s)
	if !ok {
		return 0, false
	}
	nsecs -= offsetNsecs
	s = prefix

	// Parse optional fractional part of seconds.
	if len(s) == 0 {
		return nsecs, true
	}
	if s[0] == '.' {
		s = s[1:]
	}
	digits := len(s)
	if digits > 9 {
		return 0, false
	}
	n64, ok := tryParseDateUint64(s)
	if !ok {
		return 0, false
	}

	if digits < 9 {
		n64 *= uint64(math.Pow10(9 - digits))
	}
	nsecs += int64(n64)
	return nsecs, true
}

func parseTimezoneOffset(s string) (int64, string, bool) {
	if strings.HasSuffix(s, "Z") {
		return 0, s[:len(s)-1], true
	}

	n := strings.LastIndexAny(s, "+-")
	if n < 0 {
		offsetNsecs := GetLocalTimezoneOffsetNsecs()
		return offsetNsecs, s, true
	}
	offsetStr := s[n+1:]
	isMinus := s[n] == '-'
	if len(offsetStr) == 0 {
		return 0, s, false
	}
	offsetNsecs, ok := tryParseHHMM(offsetStr)
	if !ok {
		return 0, s, false
	}
	if isMinus {
		offsetNsecs = -offsetNsecs
	}
	return offsetNsecs, s[:n], true
}

func tryParseHHMM(s string) (int64, bool) {
	if len(s) != len("hh:mm") || s[2] != ':' {
		return 0, false
	}
	hourStr := s[:2]
	minuteStr := s[3:]
	hours, ok := tryParseDateUint64(hourStr)
	if !ok || hours > 24 {
		return 0, false
	}
	minutes, ok := tryParseDateUint64(minuteStr)
	if !ok || minutes > 60 {
		return 0, false
	}
	return int64(hours)*nsecsPerHour + int64(minutes)*nsecsPerMinute, true
}

// tryParseTimestampSecs parses YYYY-MM-DDTHH:mm:ss into unix timestamp in seconds.
func tryParseTimestampSecs(s string) (int64, bool, string) {
	// Parse year
	if s[len("YYYY")] != '-' {
		return 0, false, s
	}
	yearStr := s[:len("YYYY")]
	n, ok := tryParseDateUint64(yearStr)
	if !ok || n < 1677 || n > 2262 {
		return 0, false, s
	}
	year := int(n)
	s = s[len("YYYY")+1:]

	// Parse month
	if s[len("MM")] != '-' {
		return 0, false, s
	}
	monthStr := s[:len("MM")]
	n, ok = tryParseDateUint64(monthStr)
	if !ok {
		return 0, false, s
	}
	month := time.Month(n)
	s = s[len("MM")+1:]

	// Parse day.
	//
	// Allow whitespace additionally to T as the delimiter after DD,
	// so SQL datetime format can be parsed additionally to RFC3339.
	// See https://github.com/VictoriaMetrics/VictoriaMetrics/issues/6721
	delim := s[len("DD")]
	if delim != 'T' && delim != ' ' {
		return 0, false, s
	}
	dayStr := s[:len("DD")]
	n, ok = tryParseDateUint64(dayStr)
	if !ok {
		return 0, false, s
	}
	day := int(n)
	s = s[len("DD")+1:]

	// Parse hour
	if s[len("HH")] != ':' {
		return 0, false, s
	}
	hourStr := s[:len("HH")]
	n, ok = tryParseDateUint64(hourStr)
	if !ok {
		return 0, false, s
	}
	hour := int(n)
	s = s[len("HH")+1:]

	// Parse minute
	if s[len("MM")] != ':' {
		return 0, false, s
	}
	minuteStr := s[:len("MM")]
	n, ok = tryParseDateUint64(minuteStr)
	if !ok {
		return 0, false, s
	}
	minute := int(n)
	s = s[len("MM")+1:]

	// Parse second
	secondStr := s[:len("SS")]
	n, ok = tryParseDateUint64(secondStr)
	if !ok {
		return 0, false, s
	}
	second := int(n)
	s = s[len("SS"):]

	secs := time.Date(year, month, day, hour, minute, second, 0, time.UTC).Unix()
	if secs < int64(-1<<63)/1e9 || secs >= int64((1<<63)-1)/1e9 {
		// Too big or too small timestamp
		return 0, false, s
	}
	return secs, true, s
}

// tryParseDateUint64 parses s (which is a part of some timestamp) as uint64 value.
func tryParseDateUint64(s string) (uint64, bool) {
	if len(s) == 0 || len(s) > 9 {
		return 0, false
	}

	if len(s) == 2 {
		// fast path for two-digit number, which is used in hours, minutes and seconds
		if s[0] < '0' || s[0] > '9' {
			return 0, false
		}
		n := 10*uint64(s[0]-'0') + uint64(s[1]-'0')
		return n, true
	}

	n := uint64(0)
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch < '0' || ch > '9' {
			return 0, false
		}
		if n > ((1<<64)-1)/10 {
			return 0, false
		}
		n *= 10
		d := uint64(ch - '0')
		if n > (1<<64)-1-d {
			return 0, false
		}
		n += d
	}
	return n, true
}

// GetLocalTimezoneOffsetNsecs returns local timezone offset in nanoseconds.
// It accounts for DST automatically.
func GetLocalTimezoneOffsetNsecs() int64 {
	_, offset := time.Now().Zone()
	return int64(offset) * 1e9
}

// ReplaceTemplateVariable get query and use it expression to remove grafana template variables with
func ReplaceTemplateVariable(expr string, interval int64, timeRange backend.TimeRange) string {
	expr = strings.ReplaceAll(expr, varRange, timeRangeToString(timeRange))
	expr = strings.ReplaceAll(expr, varIntervalMs, strconv.FormatInt(interval, 10))
	expr = strings.ReplaceAll(expr, varInterval, formatDuration(time.Duration(interval)*time.Millisecond))
	return expr
}

func formatDuration(inter time.Duration) string {
	switch {
	case inter >= year:
		return fmt.Sprintf("%dy", inter/year)
	case inter >= day:
		return fmt.Sprintf("%dd", inter/day)
	case inter >= time.Hour:
		return fmt.Sprintf("%dh", inter/time.Hour)
	case inter >= time.Minute:
		return fmt.Sprintf("%dm", inter/time.Minute)
	case inter >= time.Second:
		return fmt.Sprintf("%ds", inter/time.Second)
	case inter >= time.Millisecond:
		return fmt.Sprintf("%dms", inter/time.Millisecond)
	default:
		return "1ms"
	}
}

// GetIntervalFrom returns the minimum interval.
// dsInterval is the string representation of data source min interval, if configured.
// queryInterval is the string representation of query interval (min interval), e.g. "10ms" or "10s".
// queryIntervalMS is a pre-calculated numeric representation of the query interval in milliseconds.
func GetIntervalFrom(dsInterval, queryInterval string, queryIntervalMS int64, defaultInterval time.Duration) (time.Duration, error) {
	// Apparently we are setting default value of queryInterval to 0s now
	interval := queryInterval
	if interval == "0s" {
		interval = ""
	}
	if interval == "" {
		if queryIntervalMS != 0 {
			return time.Duration(queryIntervalMS) * time.Millisecond, nil
		}
	}
	if interval == "" && dsInterval != "" {
		interval = dsInterval
	}
	if interval == "" {
		return defaultInterval, nil
	}

	parsedInterval, err := parseIntervalStringToTimeDuration(interval)
	if err != nil {
		return time.Duration(0), err
	}

	return parsedInterval, nil
}

// CalculateStep calculates step by provided max datapoints and timerange
func CalculateStep(minInterval time.Duration, timeRange backend.TimeRange, maxDataPoints int64) time.Duration {
	resolution := maxDataPoints
	if resolution == 0 {
		resolution = defaultResolution
	}

	rangeValue := timeRange.To.UnixNano() - timeRange.From.UnixNano()

	calculatedInterval := time.Duration(rangeValue / resolution)

	if calculatedInterval < minInterval {
		return roundInterval(minInterval)
	}

	return roundInterval(calculatedInterval)
}

// WithIntervalVariable checks if the expression contains interval variable
func WithIntervalVariable(expr string) bool {
	return expr == varInterval
}

// parseIntervalStringToTimeDuration tries to parse interval string to duration representation
func parseIntervalStringToTimeDuration(interval string) (time.Duration, error) {
	formattedInterval := strings.Replace(strings.Replace(interval, "<", "", 1), ">", "", 1)
	isPureNum, err := regexp.MatchString(`^\d+$`, formattedInterval)
	if err != nil {
		return time.Duration(0), err
	}
	if isPureNum {
		formattedInterval += "s"
	}
	parsedInterval, err := gtime.ParseDuration(formattedInterval)
	if err != nil {
		return time.Duration(0), err
	}
	return parsedInterval, nil
}

func roundInterval(interval time.Duration) time.Duration {
	switch {
	case interval <= 10*time.Millisecond:
		return time.Millisecond * 1 // 0.001s
	// 0.015s
	case interval <= 15*time.Millisecond:
		return time.Millisecond * 10 // 0.01s
	// 0.035s
	case interval <= 35*time.Millisecond:
		return time.Millisecond * 20 // 0.02s
	// 0.075s
	case interval <= 75*time.Millisecond:
		return time.Millisecond * 50 // 0.05s
	// 0.15s
	case interval <= 150*time.Millisecond:
		return time.Millisecond * 100 // 0.1s
	// 0.35s
	case interval <= 350*time.Millisecond:
		return time.Millisecond * 200 // 0.2s
	// 0.75s
	case interval <= 750*time.Millisecond:
		return time.Millisecond * 500 // 0.5s
	// 1.5s
	case interval <= 1500*time.Millisecond:
		return time.Millisecond * 1000 // 1s
	// 3.5s
	case interval <= 3500*time.Millisecond:
		return time.Millisecond * 2000 // 2s
	// 7.5s
	case interval <= 7500*time.Millisecond:
		return time.Millisecond * 5000 // 5s
	// 12.5s
	case interval <= 12500*time.Millisecond:
		return time.Millisecond * 10000 // 10s
	// 17.5s
	case interval <= 17500*time.Millisecond:
		return time.Millisecond * 15000 // 15s
	// 25s
	case interval <= 25000*time.Millisecond:
		return time.Millisecond * 20000 // 20s
	// 45s
	case interval <= 45000*time.Millisecond:
		return time.Millisecond * 30000 // 30s
	// 1.5m
	case interval <= 90000*time.Millisecond:
		return time.Millisecond * 60000 // 1m
	// 3.5m
	case interval <= 210000*time.Millisecond:
		return time.Millisecond * 120000 // 2m
	// 7.5m
	case interval <= 450000*time.Millisecond:
		return time.Millisecond * 300000 // 5m
	// 12.5m
	case interval <= 750000*time.Millisecond:
		return time.Millisecond * 600000 // 10m
	// 17.5m
	case interval <= 1050000*time.Millisecond:
		return time.Millisecond * 900000 // 15m
	// 25m
	case interval <= 1500000*time.Millisecond:
		return time.Millisecond * 1200000 // 20m
	// 45m
	case interval <= 2700000*time.Millisecond:
		return time.Millisecond * 1800000 // 30m
	// 1.5h
	case interval <= 5400000*time.Millisecond:
		return time.Millisecond * 3600000 // 1h
	// 2.5h
	case interval <= 9000000*time.Millisecond:
		return time.Millisecond * 7200000 // 2h
	// 4.5h
	case interval <= 16200000*time.Millisecond:
		return time.Millisecond * 10800000 // 3h
	// 9h
	case interval <= 32400000*time.Millisecond:
		return time.Millisecond * 21600000 // 6h
	// 24h
	case interval <= 86400000*time.Millisecond:
		return time.Millisecond * 43200000 // 12h
	// 48h
	case interval <= 172800000*time.Millisecond:
		return time.Millisecond * 86400000 // 24h
	// 1w
	case interval <= 604800000*time.Millisecond:
		return time.Millisecond * 86400000 // 24h
	// 3w
	case interval <= 1814400000*time.Millisecond:
		return time.Millisecond * 604800000 // 1w
	// 2y
	case interval < 3628800000*time.Millisecond:
		return time.Millisecond * 2592000000 // 30d
	default:
		return time.Millisecond * 31536000000 // 1y
	}
}

// AddTimeFieldWithRange adds time field with range to the query
func AddTimeFieldWithRange(expr string, timeRange backend.TimeRange) string {
	if expr == "" {
		return expr
	}

	if hasTimeField(expr) {
		return expr
	}

	timeRangeStr := timeRangeToString(timeRange)
	return fmt.Sprintf("%s:%s %s", timeField, timeRangeStr, expr)
}

func timeRangeToString(timeRange backend.TimeRange) string {
	return fmt.Sprintf("[%s, %s]", strconv.FormatInt(timeRange.From.Unix(), 10), strconv.FormatInt(timeRange.To.Unix(), 10))
}

func hasTimeField(expr string) bool {
	parts := strings.Split(expr, "|")
	if len(parts) > 1 {
		expr = parts[0]
		return strings.Contains(expr, timeField)
	}

	return strings.Contains(expr, timeField)
}
