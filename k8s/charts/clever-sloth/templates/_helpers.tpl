{{/*
_helpers.tpl — reusable template snippets. Anything defined here with
`define` can be pulled into other templates with `include`. This keeps us
from repeating the same label block in every file (DRY).
Files starting with "_" are partials: Helm does NOT render them into
Kubernetes objects on their own.
*/}}

{{/*
Common labels applied to every object. Kubernetes recommends these
"app.kubernetes.io/*" labels so tools (kubectl, dashboards) can group resources.
Usage in a template:  {{- include "clever-sloth.labels" . | nindent 4 }}
*/}}
{{- define "clever-sloth.labels" -}}
app.kubernetes.io/part-of: clever-sloth
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}
