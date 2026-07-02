package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// CleverSlothProjectSpec is the desired state of a project tenant.
type CleverSlothProjectSpec struct {
	// DisplayName is a human-friendly label for the project.
	// +optional
	DisplayName string `json:"displayName,omitempty"`

	// Members are usernames granted edit access to the project's namespace
	// (bound as RBAC User subjects).
	// +optional
	Members []string `json:"members,omitempty"`
}

// CleverSlothProjectStatus is the observed state, written back by the controller.
type CleverSlothProjectStatus struct {
	// Phase is a high-level summary: "Pending" or "Ready".
	// +optional
	Phase string `json:"phase,omitempty"`

	// Namespace is the namespace provisioned for this project.
	// +optional
	Namespace string `json:"namespace,omitempty"`
}

// CleverSlothProject provisions an isolated tenant: a dedicated namespace with
// member RBAC and a default-deny NetworkPolicy. It is cluster-scoped.
//
// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:resource:scope=Cluster,shortName=csp
// +kubebuilder:printcolumn:name="Namespace",type=string,JSONPath=`.status.namespace`
// +kubebuilder:printcolumn:name="Phase",type=string,JSONPath=`.status.phase`
// +kubebuilder:printcolumn:name="Age",type=date,JSONPath=`.metadata.creationTimestamp`
type CleverSlothProject struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   CleverSlothProjectSpec   `json:"spec,omitempty"`
	Status CleverSlothProjectStatus `json:"status,omitempty"`
}

// CleverSlothProjectList is a list of CleverSlothProject.
//
// +kubebuilder:object:root=true
type CleverSlothProjectList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []CleverSlothProject `json:"items"`
}

func init() {
	SchemeBuilder.Register(&CleverSlothProject{}, &CleverSlothProjectList{})
}
