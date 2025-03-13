// This file was automatically generated by genny.
// Any changes will be lost if this file is regenerated.
// see https://github.com/cheekybits/genny

package data

import (
	"encoding/json"
	"time"
)

type nullableUint8Vector []*uint8

func newNullableUint8Vector(n int) *nullableUint8Vector {
	v := nullableUint8Vector(make([]*uint8, n))
	return &v
}

func newNullableUint8VectorWithValues(s []*uint8) *nullableUint8Vector {
	v := make([]*uint8, len(s))
	copy(v, s)
	return (*nullableUint8Vector)(&v)
}

func (v *nullableUint8Vector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*uint8)
}

func (v *nullableUint8Vector) SetConcrete(idx int, i interface{}) {
	val := i.(uint8)
	(*v)[idx] = &val
}

func (v *nullableUint8Vector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*uint8))
}

func (v *nullableUint8Vector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableUint8Vector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableUint8Vector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *uint8
		return g
	}
	var g uint8
	g = *(*v)[i]
	return &g
}

func (v *nullableUint8Vector) ConcreteAt(i int) (interface{}, bool) {
	var g uint8
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableUint8Vector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableUint8Vector) Len() int {
	return len(*v)
}

func (v *nullableUint8Vector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableUint8Vector) Extend(i int) {
	*v = append(*v, make([]*uint8, i)...)
}

func (v *nullableUint8Vector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableUint8Vector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableUint16Vector []*uint16

func newNullableUint16Vector(n int) *nullableUint16Vector {
	v := nullableUint16Vector(make([]*uint16, n))
	return &v
}

func newNullableUint16VectorWithValues(s []*uint16) *nullableUint16Vector {
	v := make([]*uint16, len(s))
	copy(v, s)
	return (*nullableUint16Vector)(&v)
}

func (v *nullableUint16Vector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*uint16)
}

func (v *nullableUint16Vector) SetConcrete(idx int, i interface{}) {
	val := i.(uint16)
	(*v)[idx] = &val
}

func (v *nullableUint16Vector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*uint16))
}

func (v *nullableUint16Vector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableUint16Vector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableUint16Vector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *uint16
		return g
	}
	var g uint16
	g = *(*v)[i]
	return &g
}

func (v *nullableUint16Vector) ConcreteAt(i int) (interface{}, bool) {
	var g uint16
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableUint16Vector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableUint16Vector) Len() int {
	return len(*v)
}

func (v *nullableUint16Vector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableUint16Vector) Extend(i int) {
	*v = append(*v, make([]*uint16, i)...)
}

func (v *nullableUint16Vector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableUint16Vector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableUint32Vector []*uint32

func newNullableUint32Vector(n int) *nullableUint32Vector {
	v := nullableUint32Vector(make([]*uint32, n))
	return &v
}

func newNullableUint32VectorWithValues(s []*uint32) *nullableUint32Vector {
	v := make([]*uint32, len(s))
	copy(v, s)
	return (*nullableUint32Vector)(&v)
}

func (v *nullableUint32Vector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*uint32)
}

func (v *nullableUint32Vector) SetConcrete(idx int, i interface{}) {
	val := i.(uint32)
	(*v)[idx] = &val
}

func (v *nullableUint32Vector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*uint32))
}

func (v *nullableUint32Vector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableUint32Vector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableUint32Vector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *uint32
		return g
	}
	var g uint32
	g = *(*v)[i]
	return &g
}

func (v *nullableUint32Vector) ConcreteAt(i int) (interface{}, bool) {
	var g uint32
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableUint32Vector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableUint32Vector) Len() int {
	return len(*v)
}

func (v *nullableUint32Vector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableUint32Vector) Extend(i int) {
	*v = append(*v, make([]*uint32, i)...)
}

func (v *nullableUint32Vector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableUint32Vector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableUint64Vector []*uint64

func newNullableUint64Vector(n int) *nullableUint64Vector {
	v := nullableUint64Vector(make([]*uint64, n))
	return &v
}

func newNullableUint64VectorWithValues(s []*uint64) *nullableUint64Vector {
	v := make([]*uint64, len(s))
	copy(v, s)
	return (*nullableUint64Vector)(&v)
}

func (v *nullableUint64Vector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*uint64)
}

func (v *nullableUint64Vector) SetConcrete(idx int, i interface{}) {
	val := i.(uint64)
	(*v)[idx] = &val
}

func (v *nullableUint64Vector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*uint64))
}

func (v *nullableUint64Vector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableUint64Vector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableUint64Vector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *uint64
		return g
	}
	var g uint64
	g = *(*v)[i]
	return &g
}

func (v *nullableUint64Vector) ConcreteAt(i int) (interface{}, bool) {
	var g uint64
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableUint64Vector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableUint64Vector) Len() int {
	return len(*v)
}

func (v *nullableUint64Vector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableUint64Vector) Extend(i int) {
	*v = append(*v, make([]*uint64, i)...)
}

func (v *nullableUint64Vector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableUint64Vector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableInt8Vector []*int8

func newNullableInt8Vector(n int) *nullableInt8Vector {
	v := nullableInt8Vector(make([]*int8, n))
	return &v
}

func newNullableInt8VectorWithValues(s []*int8) *nullableInt8Vector {
	v := make([]*int8, len(s))
	copy(v, s)
	return (*nullableInt8Vector)(&v)
}

func (v *nullableInt8Vector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*int8)
}

func (v *nullableInt8Vector) SetConcrete(idx int, i interface{}) {
	val := i.(int8)
	(*v)[idx] = &val
}

func (v *nullableInt8Vector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*int8))
}

func (v *nullableInt8Vector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableInt8Vector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableInt8Vector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *int8
		return g
	}
	var g int8
	g = *(*v)[i]
	return &g
}

func (v *nullableInt8Vector) ConcreteAt(i int) (interface{}, bool) {
	var g int8
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableInt8Vector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableInt8Vector) Len() int {
	return len(*v)
}

func (v *nullableInt8Vector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableInt8Vector) Extend(i int) {
	*v = append(*v, make([]*int8, i)...)
}

func (v *nullableInt8Vector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableInt8Vector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableInt16Vector []*int16

func newNullableInt16Vector(n int) *nullableInt16Vector {
	v := nullableInt16Vector(make([]*int16, n))
	return &v
}

func newNullableInt16VectorWithValues(s []*int16) *nullableInt16Vector {
	v := make([]*int16, len(s))
	copy(v, s)
	return (*nullableInt16Vector)(&v)
}

func (v *nullableInt16Vector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*int16)
}

func (v *nullableInt16Vector) SetConcrete(idx int, i interface{}) {
	val := i.(int16)
	(*v)[idx] = &val
}

func (v *nullableInt16Vector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*int16))
}

func (v *nullableInt16Vector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableInt16Vector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableInt16Vector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *int16
		return g
	}
	var g int16
	g = *(*v)[i]
	return &g
}

func (v *nullableInt16Vector) ConcreteAt(i int) (interface{}, bool) {
	var g int16
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableInt16Vector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableInt16Vector) Len() int {
	return len(*v)
}

func (v *nullableInt16Vector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableInt16Vector) Extend(i int) {
	*v = append(*v, make([]*int16, i)...)
}

func (v *nullableInt16Vector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableInt16Vector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableInt32Vector []*int32

func newNullableInt32Vector(n int) *nullableInt32Vector {
	v := nullableInt32Vector(make([]*int32, n))
	return &v
}

func newNullableInt32VectorWithValues(s []*int32) *nullableInt32Vector {
	v := make([]*int32, len(s))
	copy(v, s)
	return (*nullableInt32Vector)(&v)
}

func (v *nullableInt32Vector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*int32)
}

func (v *nullableInt32Vector) SetConcrete(idx int, i interface{}) {
	val := i.(int32)
	(*v)[idx] = &val
}

func (v *nullableInt32Vector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*int32))
}

func (v *nullableInt32Vector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableInt32Vector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableInt32Vector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *int32
		return g
	}
	var g int32
	g = *(*v)[i]
	return &g
}

func (v *nullableInt32Vector) ConcreteAt(i int) (interface{}, bool) {
	var g int32
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableInt32Vector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableInt32Vector) Len() int {
	return len(*v)
}

func (v *nullableInt32Vector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableInt32Vector) Extend(i int) {
	*v = append(*v, make([]*int32, i)...)
}

func (v *nullableInt32Vector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableInt32Vector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableInt64Vector []*int64

func newNullableInt64Vector(n int) *nullableInt64Vector {
	v := nullableInt64Vector(make([]*int64, n))
	return &v
}

func newNullableInt64VectorWithValues(s []*int64) *nullableInt64Vector {
	v := make([]*int64, len(s))
	copy(v, s)
	return (*nullableInt64Vector)(&v)
}

func (v *nullableInt64Vector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*int64)
}

func (v *nullableInt64Vector) SetConcrete(idx int, i interface{}) {
	val := i.(int64)
	(*v)[idx] = &val
}

func (v *nullableInt64Vector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*int64))
}

func (v *nullableInt64Vector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableInt64Vector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableInt64Vector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *int64
		return g
	}
	var g int64
	g = *(*v)[i]
	return &g
}

func (v *nullableInt64Vector) ConcreteAt(i int) (interface{}, bool) {
	var g int64
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableInt64Vector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableInt64Vector) Len() int {
	return len(*v)
}

func (v *nullableInt64Vector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableInt64Vector) Extend(i int) {
	*v = append(*v, make([]*int64, i)...)
}

func (v *nullableInt64Vector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableInt64Vector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableFloat32Vector []*float32

func newNullableFloat32Vector(n int) *nullableFloat32Vector {
	v := nullableFloat32Vector(make([]*float32, n))
	return &v
}

func newNullableFloat32VectorWithValues(s []*float32) *nullableFloat32Vector {
	v := make([]*float32, len(s))
	copy(v, s)
	return (*nullableFloat32Vector)(&v)
}

func (v *nullableFloat32Vector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*float32)
}

func (v *nullableFloat32Vector) SetConcrete(idx int, i interface{}) {
	val := i.(float32)
	(*v)[idx] = &val
}

func (v *nullableFloat32Vector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*float32))
}

func (v *nullableFloat32Vector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableFloat32Vector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableFloat32Vector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *float32
		return g
	}
	var g float32
	g = *(*v)[i]
	return &g
}

func (v *nullableFloat32Vector) ConcreteAt(i int) (interface{}, bool) {
	var g float32
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableFloat32Vector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableFloat32Vector) Len() int {
	return len(*v)
}

func (v *nullableFloat32Vector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableFloat32Vector) Extend(i int) {
	*v = append(*v, make([]*float32, i)...)
}

func (v *nullableFloat32Vector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableFloat32Vector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableFloat64Vector []*float64

func newNullableFloat64Vector(n int) *nullableFloat64Vector {
	v := nullableFloat64Vector(make([]*float64, n))
	return &v
}

func newNullableFloat64VectorWithValues(s []*float64) *nullableFloat64Vector {
	v := make([]*float64, len(s))
	copy(v, s)
	return (*nullableFloat64Vector)(&v)
}

func (v *nullableFloat64Vector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*float64)
}

func (v *nullableFloat64Vector) SetConcrete(idx int, i interface{}) {
	val := i.(float64)
	(*v)[idx] = &val
}

func (v *nullableFloat64Vector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*float64))
}

func (v *nullableFloat64Vector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableFloat64Vector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableFloat64Vector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *float64
		return g
	}
	var g float64
	g = *(*v)[i]
	return &g
}

func (v *nullableFloat64Vector) ConcreteAt(i int) (interface{}, bool) {
	var g float64
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableFloat64Vector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableFloat64Vector) Len() int {
	return len(*v)
}

func (v *nullableFloat64Vector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableFloat64Vector) Extend(i int) {
	*v = append(*v, make([]*float64, i)...)
}

func (v *nullableFloat64Vector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableFloat64Vector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableStringVector []*string

func newNullableStringVector(n int) *nullableStringVector {
	v := nullableStringVector(make([]*string, n))
	return &v
}

func newNullableStringVectorWithValues(s []*string) *nullableStringVector {
	v := make([]*string, len(s))
	copy(v, s)
	return (*nullableStringVector)(&v)
}

func (v *nullableStringVector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*string)
}

func (v *nullableStringVector) SetConcrete(idx int, i interface{}) {
	val := i.(string)
	(*v)[idx] = &val
}

func (v *nullableStringVector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*string))
}

func (v *nullableStringVector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableStringVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableStringVector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *string
		return g
	}
	var g string
	g = *(*v)[i]
	return &g
}

func (v *nullableStringVector) ConcreteAt(i int) (interface{}, bool) {
	var g string
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableStringVector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableStringVector) Len() int {
	return len(*v)
}

func (v *nullableStringVector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableStringVector) Extend(i int) {
	*v = append(*v, make([]*string, i)...)
}

func (v *nullableStringVector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableStringVector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableBoolVector []*bool

func newNullableBoolVector(n int) *nullableBoolVector {
	v := nullableBoolVector(make([]*bool, n))
	return &v
}

func newNullableBoolVectorWithValues(s []*bool) *nullableBoolVector {
	v := make([]*bool, len(s))
	copy(v, s)
	return (*nullableBoolVector)(&v)
}

func (v *nullableBoolVector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*bool)
}

func (v *nullableBoolVector) SetConcrete(idx int, i interface{}) {
	val := i.(bool)
	(*v)[idx] = &val
}

func (v *nullableBoolVector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*bool))
}

func (v *nullableBoolVector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableBoolVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableBoolVector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *bool
		return g
	}
	var g bool
	g = *(*v)[i]
	return &g
}

func (v *nullableBoolVector) ConcreteAt(i int) (interface{}, bool) {
	var g bool
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableBoolVector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableBoolVector) Len() int {
	return len(*v)
}

func (v *nullableBoolVector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableBoolVector) Extend(i int) {
	*v = append(*v, make([]*bool, i)...)
}

func (v *nullableBoolVector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableBoolVector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableTimeTimeVector []*time.Time

func newNullableTimeTimeVector(n int) *nullableTimeTimeVector {
	v := nullableTimeTimeVector(make([]*time.Time, n))
	return &v
}

func newNullableTimeTimeVectorWithValues(s []*time.Time) *nullableTimeTimeVector {
	v := make([]*time.Time, len(s))
	copy(v, s)
	return (*nullableTimeTimeVector)(&v)
}

func (v *nullableTimeTimeVector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*time.Time)
}

func (v *nullableTimeTimeVector) SetConcrete(idx int, i interface{}) {
	val := i.(time.Time)
	(*v)[idx] = &val
}

func (v *nullableTimeTimeVector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*time.Time))
}

func (v *nullableTimeTimeVector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableTimeTimeVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableTimeTimeVector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *time.Time
		return g
	}
	var g time.Time
	g = *(*v)[i]
	return &g
}

func (v *nullableTimeTimeVector) ConcreteAt(i int) (interface{}, bool) {
	var g time.Time
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableTimeTimeVector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableTimeTimeVector) Len() int {
	return len(*v)
}

func (v *nullableTimeTimeVector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableTimeTimeVector) Extend(i int) {
	*v = append(*v, make([]*time.Time, i)...)
}

func (v *nullableTimeTimeVector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableTimeTimeVector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableJsonRawMessageVector []*json.RawMessage

func newNullableJsonRawMessageVector(n int) *nullableJsonRawMessageVector {
	v := nullableJsonRawMessageVector(make([]*json.RawMessage, n))
	return &v
}

func newNullableJsonRawMessageVectorWithValues(s []*json.RawMessage) *nullableJsonRawMessageVector {
	v := make([]*json.RawMessage, len(s))
	copy(v, s)
	return (*nullableJsonRawMessageVector)(&v)
}

func (v *nullableJsonRawMessageVector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*json.RawMessage)
}

func (v *nullableJsonRawMessageVector) SetConcrete(idx int, i interface{}) {
	val := i.(json.RawMessage)
	(*v)[idx] = &val
}

func (v *nullableJsonRawMessageVector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*json.RawMessage))
}

func (v *nullableJsonRawMessageVector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableJsonRawMessageVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableJsonRawMessageVector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *json.RawMessage
		return g
	}
	var g json.RawMessage
	g = *(*v)[i]
	return &g
}

func (v *nullableJsonRawMessageVector) ConcreteAt(i int) (interface{}, bool) {
	var g json.RawMessage
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableJsonRawMessageVector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableJsonRawMessageVector) Len() int {
	return len(*v)
}

func (v *nullableJsonRawMessageVector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableJsonRawMessageVector) Extend(i int) {
	*v = append(*v, make([]*json.RawMessage, i)...)
}

func (v *nullableJsonRawMessageVector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *nullableJsonRawMessageVector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}
