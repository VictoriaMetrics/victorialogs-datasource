package plugin

// Response contains fields from query response
// It represents victoria logs response
type Response struct {
	Message string `json:"_msg"`
	Stream  string `json:"_stream"`
	Time    string `json:"_time"`
}
