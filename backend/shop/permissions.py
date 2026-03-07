from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", "") in {"ADMIN", "SUPERADMIN"}
        )


class IsAuthenticated(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", "") in {"ADMIN", "SUPERADMIN"}
        )


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and getattr(user, "role", "") == "SUPERADMIN"
        )
