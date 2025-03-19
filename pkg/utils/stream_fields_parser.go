package utils

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/VictoriaMetrics/VictoriaMetrics/lib/logger"
	"github.com/VictoriaMetrics/VictoriaMetrics/lib/regexutil"
)

// All staff was copied from the main repository
// https://github.com/VictoriaMetrics/VictoriaMetrics/blob/master/lib/logstorage/filter_stream.go
// https://github.com/VictoriaMetrics/VictoriaMetrics/blob/master/lib/logstorage/stream_filter.go
// All test covered by the main repository

// filterStream is the filter for `{}` aka `_stream:{...}`
type filterStream struct {
	// f is the filter to apply
	f *StreamFilter
}

// StreamFilter is a filter for streams, e.g. `_stream:{...}`
type StreamFilter struct {
	Filters []*AndStreamFilter
}

type AndStreamFilter struct {
	TagFilters []*StreamTagFilter
}

type StreamTagFilter struct {
	// tagName is the name for the tag to filter
	TagName string

	// op is operation such as `=`, `!=`, `=~`, `!~` or `:`
	op string

	// value is the value
	Value string

	// regexp is initialized for `=~` and `!~` op.
	regexp *regexutil.PromRegex
}

type lexer struct {
	// s contains unparsed tail of sOrig
	s string

	// sOrig contains the original string
	sOrig string

	// token contains the current token
	//
	// an empty token means the end of s
	token string

	// rawToken contains raw token before unquoting
	rawToken string

	// prevToken contains the previously parsed token
	prevToken string

	// isSkippedSpace is set to true if there was a whitespace before the token in s
	isSkippedSpace bool

	// currentTimestamp is the current timestamp in nanoseconds
	currentTimestamp int64
}

func NewStreamFilter(s string) (*StreamFilter, error) {
	lex := newLexer(s, 0)
	fs, err := parseFilterStream(lex)
	if err != nil {
		return nil, err
	}
	return fs.f, nil
}

// newLexer returns new lexer for the given s at the given timestamp.
//
// The timestamp is used for properly parsing relative timestamps such as _time:1d.
//
// The lex.token points to the first token in s.
func newLexer(s string, timestamp int64) *lexer {
	lex := &lexer{
		s:                s,
		sOrig:            s,
		currentTimestamp: timestamp,
	}
	lex.nextToken()
	return lex
}

// nextToken updates lex.token to the next token.
func (lex *lexer) nextToken() {
	s := lex.s
	lex.prevToken = lex.token
	lex.token = ""
	lex.rawToken = ""
	lex.isSkippedSpace = false

	if len(s) == 0 {
		return
	}

again:
	r, size := utf8.DecodeRuneInString(s)
	if r == utf8.RuneError {
		lex.nextCharToken(s, size)
		return
	}

	// Skip whitespace
	for unicode.IsSpace(r) {
		lex.isSkippedSpace = true
		s = s[size:]
		r, size = utf8.DecodeRuneInString(s)
	}

	if r == '#' {
		// skip comment till \n
		n := strings.IndexByte(s, '\n')
		if n < 0 {
			s = ""
		} else {
			s = s[n+1:]
		}
		goto again
	}

	// Try decoding simple token
	tokenLen := 0
	for isTokenRune(r) || r == '.' {
		tokenLen += size
		r, size = utf8.DecodeRuneInString(s[tokenLen:])
	}
	if tokenLen > 0 {
		lex.nextCharToken(s, tokenLen)
		return
	}

	switch r {
	case '"', '`':
		prefix, err := strconv.QuotedPrefix(s)
		if err != nil {
			lex.nextCharToken(s, 1)
			return
		}
		token, err := strconv.Unquote(prefix)
		if err != nil {
			lex.nextCharToken(s, 1)
			return
		}
		lex.token = token
		lex.rawToken = prefix
		lex.s = s[len(prefix):]
		return
	case '\'':
		var b []byte
		for !strings.HasPrefix(s[size:], "'") {
			ch, _, newTail, err := strconv.UnquoteChar(s[size:], '\'')
			if err != nil {
				lex.nextCharToken(s, 1)
				return
			}
			b = utf8.AppendRune(b, ch)
			size += len(s[size:]) - len(newTail)
		}
		size++
		lex.token = string(b)
		lex.rawToken = string(s[:size])
		lex.s = s[size:]
		return
	case '=':
		if strings.HasPrefix(s[size:], "~") {
			lex.nextCharToken(s, 2)
			return
		}
		lex.nextCharToken(s, 1)
		return
	case '!':
		if strings.HasPrefix(s[size:], "~") || strings.HasPrefix(s[size:], "=") {
			lex.nextCharToken(s, 2)
			return
		}
		lex.nextCharToken(s, 1)
		return
	default:
		lex.nextCharToken(s, size)
		return
	}
}

func parseFilterStream(lex *lexer) (*filterStream, error) {
	sf, err := parseStreamFilter(lex)
	if err != nil {
		return nil, err
	}
	fs := &filterStream{
		f: sf,
	}
	return fs, nil
}

func parseStreamFilter(lex *lexer) (*StreamFilter, error) {
	if !lex.isKeyword("{") {
		return nil, fmt.Errorf("unexpected token %q instead of '{' in _stream filter", lex.token)
	}
	if !lex.mustNextToken() {
		return nil, fmt.Errorf("incomplete _stream filter after '{'")
	}
	var filters []*AndStreamFilter
	for {
		f, err := parseAndStreamFilter(lex)
		if err != nil {
			return nil, err
		}
		filters = append(filters, f)
		switch {
		case lex.isKeyword("}"):
			lex.nextToken()
			sf := &StreamFilter{
				Filters: filters,
			}
			return sf, nil
		case lex.isKeyword("or"):
			if !lex.mustNextToken() {
				return nil, fmt.Errorf("incomplete _stream filter after 'or'")
			}
			if lex.isKeyword("}") {
				return nil, fmt.Errorf("unexpected '}' after 'or' in _stream filter")
			}
		default:
			return nil, fmt.Errorf("unexpected token in _stream filter: %q; want '}' or 'or'", lex.token)
		}
	}
}

func (lex *lexer) isKeyword(keywords ...string) bool {
	if lex.isQuotedToken() {
		return false
	}
	tokenLower := strings.ToLower(lex.token)
	for _, kw := range keywords {
		if kw == tokenLower {
			return true
		}
	}
	return false
}

func (lex *lexer) isQuotedToken() bool {
	return lex.token != lex.rawToken
}

func (lex *lexer) mustNextToken() bool {
	lex.nextToken()
	return !lex.isEnd()
}

func (lex *lexer) isEnd() bool {
	return len(lex.s) == 0 && len(lex.token) == 0 && len(lex.rawToken) == 0
}

func (lex *lexer) nextCharToken(s string, size int) {
	lex.token = s[:size]
	lex.rawToken = lex.token
	lex.s = s[size:]
}

func isTokenRune(c rune) bool {
	return unicode.IsLetter(c) || unicode.IsDigit(c) || c == '_'
}

func parseAndStreamFilter(lex *lexer) (*AndStreamFilter, error) {
	var filters []*StreamTagFilter
	for {
		if lex.isKeyword("}") {
			asf := &AndStreamFilter{
				TagFilters: filters,
			}
			return asf, nil
		}
		f, err := parseStreamTagFilter(lex)
		if err != nil {
			return nil, err
		}
		filters = append(filters, f)
		switch {
		case lex.isKeyword("or", "}"):
			asf := &AndStreamFilter{
				TagFilters: filters,
			}
			return asf, nil
		case lex.isKeyword(","):
			if !lex.mustNextToken() {
				return nil, fmt.Errorf("missing stream filter after ','")
			}
		default:
			return nil, fmt.Errorf("unexpected token %q in _stream filter; want 'or', 'and', '}' or ','", lex.token)
		}
	}
}

func parseStreamTagFilter(lex *lexer) (*StreamTagFilter, error) {
	// parse tagName
	tagName, err := parseStreamTagName(lex)
	if err != nil {
		return nil, fmt.Errorf("cannot parse stream tag name: %w", err)
	}
	if !lex.isKeyword("=", "!=", "=~", "!~") {
		return nil, fmt.Errorf("unsupported operation %q in _steam filter for %q field; supported operations: =, !=, =~, !~", lex.token, tagName)
	}

	// parse op
	op := lex.token
	lex.nextToken()

	// parse tag value
	value, err := parseStreamTagValue(lex)
	if err != nil {
		return nil, fmt.Errorf("cannot parse value for tag %q: %w", tagName, err)
	}
	stf := &StreamTagFilter{
		TagName: tagName,
		op:      op,
		Value:   value,
	}
	if op == "=~" || op == "!~" {
		re, err := regexutil.NewPromRegex(value)
		if err != nil {
			return nil, fmt.Errorf("invalid regexp %q for stream filter: %w", value, err)
		}
		stf.regexp = re
	}
	return stf, nil
}

func parseStreamTagValue(lex *lexer) (string, error) {
	stopTokens := []string{",", "{", "}", "'", `"`, "`", ""}
	return getCompoundTokenExt(lex, stopTokens)
}

func parseStreamTagName(lex *lexer) (string, error) {
	stopTokens := []string{"=", "!=", "=~", "!~", ",", "{", "}", "'", `"`, "`", ""}
	return getCompoundTokenExt(lex, stopTokens)
}

func getCompoundTokenExt(lex *lexer, stopTokens []string) (string, error) {
	if err := lex.isInvalidQuotedString(); err != nil {
		return "", err
	}
	if lex.isKeyword(stopTokens...) {
		return "", fmt.Errorf("compound token cannot start with '%s'", lex.token)
	}

	s := lex.token
	rawS := lex.rawToken
	lex.nextToken()
	suffix := ""
	for !lex.isSkippedSpace && !lex.isKeyword(stopTokens...) {
		s += lex.token
		lex.nextToken()
	}
	if suffix == "" {
		return s, nil
	}
	return rawS + suffix, nil
}

func (lex *lexer) isInvalidQuotedString() error {
	if lex.token != `"` && lex.token != "`" && lex.token != `'` {
		return nil
	}

	n := strings.Index(lex.s, lex.token)
	if n < 0 {
		return fmt.Errorf("missing closing quote for [%s]", lex.token+lex.s)
	}

	quotedStr := lex.token + lex.s[:n+1]
	if _, err := strconv.Unquote(quotedStr); err != nil {
		err = fmt.Errorf("cannot parse %s: %w", quotedStr, err)
		if !strings.HasPrefix(quotedStr, "`") && strings.Contains(quotedStr, `\`) {
			err = fmt.Errorf(`%w; make sure that '\' chars are properly escaped (e.g. use '\\' instead of '\'); alternatively put the string in backquotes `+"`...`", err)
		}
		return err
	}

	logger.Panicf("BUG: unexpected successful parsing of %s", quotedStr)
	return nil
}
