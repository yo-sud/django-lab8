from django.contrib import admin
from django.urls import include, path
from rest_framework.permissions import AllowAny
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from quiz.views import ExamViewSet, OptionViewSet, QuestionViewSet, dashboard

router = DefaultRouter()
router.register('exams', ExamViewSet, basename='exam')
router.register('questions', QuestionViewSet, basename='question')
router.register('options', OptionViewSet, basename='option')

urlpatterns = [
    path('', dashboard, name='home'),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/schema/', SpectacularAPIView.as_view(
        authentication_classes=[], permission_classes=[AllowAny],
    ), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(
        url_name='schema', authentication_classes=[], permission_classes=[AllowAny],
    ), name='docs'),
]
