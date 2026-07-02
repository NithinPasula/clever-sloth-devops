package controller

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"

	platformv1alpha1 "github.com/nithinpasula/clever-sloth-operator/api/v1alpha1"
)

const nsPrefix = "cs-project-"

// CleverSlothProjectReconciler reconciles a CleverSlothProject: for each one it
// ensures a namespace (owned by the CR, so it's garbage-collected on delete),
// member RBAC, and a default-deny NetworkPolicy, then writes status.
type CleverSlothProjectReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

// The controller (when deployed in-cluster) needs these permissions:
//
// +kubebuilder:rbac:groups=platform.cleversloth.io,resources=cleverslothprojects,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=platform.cleversloth.io,resources=cleverslothprojects/status,verbs=get;update;patch
// +kubebuilder:rbac:groups="",resources=namespaces,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=rbac.authorization.k8s.io,resources=roles;rolebindings,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=networking.k8s.io,resources=networkpolicies,verbs=get;list;watch;create;update;patch;delete

func (r *CleverSlothProjectReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	logger := log.FromContext(ctx)

	// Fetch the CR. If it's gone, GC handles cleanup (the namespace is owned).
	var project platformv1alpha1.CleverSlothProject
	if err := r.Get(ctx, req.NamespacedName, &project); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	nsName := nsPrefix + project.Name

	// 1) Namespace — owned by the CR so deleting the project cascades to the
	//    namespace and everything inside it.
	ns := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: nsName}}
	if _, err := controllerutil.CreateOrUpdate(ctx, r.Client, ns, func() error {
		if ns.Labels == nil {
			ns.Labels = map[string]string{}
		}
		ns.Labels["cleversloth.io/project"] = project.Name
		ns.Labels["app.kubernetes.io/managed-by"] = "clever-sloth-operator"
		return controllerutil.SetControllerReference(&project, ns, r.Scheme)
	}); err != nil {
		return ctrl.Result{}, fmt.Errorf("ensuring namespace: %w", err)
	}

	// 2) Role — edit access to common resources within the project namespace.
	role := &rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "project-member", Namespace: nsName}}
	if _, err := controllerutil.CreateOrUpdate(ctx, r.Client, role, func() error {
		role.Rules = []rbacv1.PolicyRule{{
			APIGroups: []string{"", "apps", "batch"},
			Resources: []string{
				"pods", "services", "configmaps", "secrets",
				"persistentvolumeclaims", "deployments", "statefulsets", "jobs",
			},
			Verbs: []string{"get", "list", "watch", "create", "update", "patch", "delete"},
		}}
		return nil
	}); err != nil {
		return ctrl.Result{}, fmt.Errorf("ensuring role: %w", err)
	}

	// 3) RoleBinding — bind the listed members (as Users) to that Role.
	rb := &rbacv1.RoleBinding{ObjectMeta: metav1.ObjectMeta{Name: "project-members", Namespace: nsName}}
	if _, err := controllerutil.CreateOrUpdate(ctx, r.Client, rb, func() error {
		subjects := make([]rbacv1.Subject, 0, len(project.Spec.Members))
		for _, m := range project.Spec.Members {
			subjects = append(subjects, rbacv1.Subject{
				Kind:     rbacv1.UserKind,
				Name:     m,
				APIGroup: rbacv1.GroupName,
			})
		}
		rb.Subjects = subjects
		rb.RoleRef = rbacv1.RoleRef{
			APIGroup: rbacv1.GroupName,
			Kind:     "Role",
			Name:     "project-member",
		}
		return nil
	}); err != nil {
		return ctrl.Result{}, fmt.Errorf("ensuring rolebinding: %w", err)
	}

	// 4) NetworkPolicy — default-deny ingress isolates the project's traffic.
	np := &networkingv1.NetworkPolicy{ObjectMeta: metav1.ObjectMeta{Name: "default-deny-ingress", Namespace: nsName}}
	if _, err := controllerutil.CreateOrUpdate(ctx, r.Client, np, func() error {
		np.Spec = networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{},
			PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
		}
		return nil
	}); err != nil {
		return ctrl.Result{}, fmt.Errorf("ensuring networkpolicy: %w", err)
	}

	// 5) Status — reflect what we provisioned.
	if project.Status.Namespace != nsName || project.Status.Phase != "Ready" {
		project.Status.Namespace = nsName
		project.Status.Phase = "Ready"
		if err := r.Status().Update(ctx, &project); err != nil {
			return ctrl.Result{}, fmt.Errorf("updating status: %w", err)
		}
	}

	logger.Info("reconciled CleverSlothProject", "project", project.Name, "namespace", nsName,
		"members", len(project.Spec.Members))
	return ctrl.Result{}, nil
}

// SetupWithManager wires the controller to watch CleverSlothProjects and the
// Namespaces it owns (so a manual namespace change triggers a re-reconcile).
func (r *CleverSlothProjectReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&platformv1alpha1.CleverSlothProject{}).
		Owns(&corev1.Namespace{}).
		Complete(r)
}
