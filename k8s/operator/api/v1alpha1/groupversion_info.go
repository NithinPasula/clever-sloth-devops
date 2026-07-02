// Package v1alpha1 contains the CleverSlothProject API group.
//
// +kubebuilder:object:generate=true
// +groupName=platform.cleversloth.io
package v1alpha1

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/scheme"
)

var (
	// GroupVersion is the API group + version this package registers.
	GroupVersion = schema.GroupVersion{Group: "platform.cleversloth.io", Version: "v1alpha1"}

	// SchemeBuilder registers our types into a runtime.Scheme.
	SchemeBuilder = &scheme.Builder{GroupVersion: GroupVersion}

	// AddToScheme adds the types in this group-version to a scheme.
	AddToScheme = SchemeBuilder.AddToScheme
)
