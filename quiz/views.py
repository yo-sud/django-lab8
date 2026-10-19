from django.shortcuts import render
from rest_framework import serializers, viewsets
from django.db.models import Count
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from .models import Exam, Option, Question
from .serializers import ExamSerializer, OptionSerializer, QuestionSerializer


def dashboard(request):
    return render(request, 'quiz/dashboard.html')


class ExamViewSet(viewsets.ModelViewSet):
    queryset = Exam.objects.annotate(question_count=Count('questions')).order_by('id')
    serializer_class = ExamSerializer


@extend_schema_view(
    list=extend_schema(parameters=[
        OpenApiParameter('exam', int, description='Filtra preguntas por el identificador del examen.'),
    ])
)
class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.select_related('exam').prefetch_related('options').all()
    serializer_class = QuestionSerializer
    filterset_fields = ['exam']
    search_fields = ['text']
    filter_backends = [DjangoFilterBackend, SearchFilter]


class OptionViewSet(viewsets.ModelViewSet):
    queryset = Option.objects.select_related('question').all()
    serializer_class = OptionSerializer

    def perform_destroy(self, instance):
        if instance.is_correct and instance.question.options.filter(is_correct=True).count() == 1:
            raise serializers.ValidationError(
                {'detail': 'Cada pregunta debe conservar exactamente una opción correcta.'}
            )
        instance.delete()
