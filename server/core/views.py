from rest_framework.views import APIView
from rest_framework.response import Response
from .serializers import PingSerializer

class PingView(APIView):
    def get(self, request):
        return Response({"message": "DriftBox API is live 🚀"})
