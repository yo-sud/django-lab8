from rest_framework.permissions import SAFE_METHODS, BasePermission


AGENT_GROUP = 'agente'


class AgentPermission(BasePermission):
    """Allow staff full access, agent-group members non-destructive writes, and others read-only."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.groups.filter(name=AGENT_GROUP).exists():
            # PATCH/PUT can trigger nested replacement paths that delete related rows.
            # Keep the agent strictly read/create; only staff may modify or delete.
            return request.method in SAFE_METHODS or request.method == 'POST'
        if user.is_staff:
            return True
        return request.method in SAFE_METHODS
