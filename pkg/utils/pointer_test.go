package utils

import "testing"

func TestPtr(t *testing.T) {
	type T int

	val := T(0)
	pointer := Ptr(val)
	if *pointer != val {
		t.Errorf("expected %d, got %d", val, *pointer)
	}

	val = T(1)
	pointer = Ptr(val)
	if *pointer != val {
		t.Errorf("expected %d, got %d", val, *pointer)
	}
}
