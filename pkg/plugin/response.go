package plugin

const (
	messageField = "_msg"
	streamField  = "_stream"
	timeField    = "_time"
)

// Response contains fields from query response
// It represents victoria logs response
type Response map[string]string
