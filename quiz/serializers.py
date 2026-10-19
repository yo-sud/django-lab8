from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from .models import Exam, Option, Question


class ExamSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Exam
        fields = ['id', 'title', 'description', 'created_at', 'updated_at', 'question_count']
        read_only_fields = ['id', 'created_at', 'updated_at']


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'question', 'text', 'is_correct', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        question = attrs.get('question', getattr(self.instance, 'question', None))
        is_correct = attrs.get('is_correct', getattr(self.instance, 'is_correct', False))
        if question is None:
            return attrs
        options = question.options.all()
        if self.instance:
            options = options.exclude(pk=self.instance.pk)
        correct_count = options.filter(is_correct=True).count() + int(is_correct)
        if correct_count != 1:
            raise ValidationError({'is_correct': 'Cada pregunta debe tener exactamente una opción correcta.'})
        return attrs


class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct']
        read_only_fields = ['id']


class QuestionSerializer(serializers.ModelSerializer):
    exam = serializers.PrimaryKeyRelatedField(queryset=Exam.objects.all())
    choices = QuestionOptionSerializer(many=True, source='options', required=True)
    options = QuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'exam', 'text', 'choices', 'options', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_choices(self, choices):
        if len(choices) < 2:
            raise ValidationError('La pregunta debe tener al menos dos opciones.')
        correct_count = sum(1 for choice in choices if choice.get('is_correct', False))
        if correct_count != 1:
            raise ValidationError('La pregunta debe tener exactamente una opción correcta.')
        return choices

    @transaction.atomic
    def create(self, validated_data):
        options_data = validated_data.pop('options')
        question = Question.objects.create(**validated_data)
        Option.objects.bulk_create([Option(question=question, **option) for option in options_data])
        return question

    @transaction.atomic
    def update(self, instance, validated_data):
        options_data = validated_data.pop('options', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if options_data is not None:
            instance.options.all().delete()
            Option.objects.bulk_create([Option(question=instance, **option) for option in options_data])
        return instance
