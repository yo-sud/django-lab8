"""Server-side role checks, including the agent's permanent delete restriction."""
from rest_framework.test import APITestCase

from quiz.models import Option, Question

from .helpers import exam_id, reader_token, seed, valid_body


class RoleTests(APITestCase):
    def setUp(self):
        self.person, self.agent = seed()
        self.reader = reader_token()

    def as_(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        return self.client

    def test_the_agent_can_read(self):
        self.assertEqual(self.as_(self.agent).get("/api/questions/").status_code, 200)

    def test_the_agent_can_create(self):
        response = self.as_(self.agent).post("/api/questions/", valid_body(exam_id()), format="json")
        self.assertEqual(response.status_code, 201)

    def test_the_agent_cannot_modify_or_replace_nested_options(self):
        question = Question.objects.first()
        original_options = list(question.options.values_list("id", "text", "is_correct"))
        body = {
            "exam": question.exam_id,
            "text": "Intento de reemplazo del agente",
            "choices": [
                {"text": "Alternativa nueva correcta", "is_correct": True},
                {"text": "Alternativa nueva", "is_correct": False},
            ],
        }
        response = self.as_(self.agent).patch(f"/api/questions/{question.id}/", body, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(list(Option.objects.filter(question=question).values_list("id", "text", "is_correct")),
                         original_options)
        self.assertNotEqual(question.__class__.objects.get(pk=question.pk).text, body["text"])

    def test_the_agent_cannot_put_or_patch_any_resource(self):
        exam = Question.objects.first().exam
        question = Question.objects.first()
        option = question.options.first()
        self.assertEqual(self.as_(self.agent).put(
            f"/api/exams/{exam.pk}/", {"title": "No cambiar", "description": ""}, format="json"
        ).status_code, 403)
        self.assertEqual(self.as_(self.agent).patch(
            f"/api/options/{option.pk}/", {"text": "No cambiar"}, format="json"
        ).status_code, 403)

    def test_the_agent_cannot_delete(self):
        question = Question.objects.first()
        response = self.as_(self.agent).delete(f"/api/questions/{question.id}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Question.objects.filter(id=question.id).exists())

    def test_the_agent_cannot_delete_an_exam_either(self):
        self.assertEqual(self.as_(self.agent).delete(f"/api/exams/{exam_id()}/").status_code, 403)

    def test_the_agent_cannot_delete_an_option(self):
        option = Question.objects.first().options.first()
        response = self.as_(self.agent).delete(f"/api/options/{option.pk}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Option.objects.filter(pk=option.pk).exists())

    def test_agent_group_cannot_delete_even_if_the_account_is_staff(self):
        from django.contrib.auth.models import User

        user = User.objects.get(username="agente")
        user.is_staff = True
        user.save(update_fields=["is_staff"])
        question = Question.objects.first()
        response = self.as_(self.agent).delete(f"/api/questions/{question.id}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Question.objects.filter(pk=question.pk).exists())

    def test_a_person_can_delete(self):
        question = Question.objects.first()
        self.assertEqual(self.as_(self.person).delete(f"/api/questions/{question.id}/").status_code, 204)

    def test_somebody_without_a_role_can_only_read(self):
        self.assertEqual(self.as_(self.reader).get("/api/questions/").status_code, 200)
        self.assertEqual(
            self.as_(self.reader).post("/api/questions/", valid_body(exam_id()), format="json").status_code, 403
        )

    def test_no_token_is_401_not_403(self):
        self.client.credentials()
        self.assertEqual(self.client.get("/api/questions/").status_code, 401)
