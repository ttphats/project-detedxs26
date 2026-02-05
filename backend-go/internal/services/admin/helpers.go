package admin

import "strings"

// joinStr joins string slices with a separator
func joinStr(strs []string, sep string) string {
	return strings.Join(strs, sep)
}

// Pagination represents pagination info
type Pagination struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

