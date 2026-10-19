from django.core.management.base import BaseCommand
from django.db import transaction

from quiz.models import Exam, Option, Question
from quiz.seed_data import CONCEPT_ART_EXAMS


class Command(BaseCommand):
    help = "Agrega dos cuestionarios de arte conceptual para modelado y diseño 3D sin reemplazar datos."

    @transaction.atomic
    def handle(self, *args, **options):
        added = 0
        existing = 0
        for title, description, questions_data in CONCEPT_ART_EXAMS:
            if Exam.objects.filter(title=title).exists():
                existing += 1
                continue

            exam = Exam.objects.create(title=title, description=description)
            for text, choices in questions_data:
                question = Question.objects.create(exam=exam, text=text)
                Option.objects.bulk_create(
                    Option(question=question, text=choice, is_correct=is_correct)
                    for choice, is_correct in choices
                )
            added += 1

        self.stdout.write(self.style.SUCCESS(
            f"Cuestionarios nuevos: {added}; ya existentes: {existing}. "
            f"Total actual: {Exam.objects.count()} exámenes, "
            f"{Question.objects.count()} preguntas."
        ))
