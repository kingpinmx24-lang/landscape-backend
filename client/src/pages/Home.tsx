import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight, Zap, Users, TrendingUp, CheckCircle } from "lucide-react";
import { getLoginUrl } from "@/const";

/**
 * Página de inicio del sistema de diseño de paisajismo
 */
export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🌿</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">LandscapeApp</h1>
            </div>
            <Button onClick={() => window.location.href = getLoginUrl()}>
              Iniciar Sesión
            </Button>
          </div>
        </header>

        {/* Hero */}
        <main className="max-w-7xl mx-auto px-4 py-20">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              Diseña Paisajes Profesionales en Minutos
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Captura, diseña, ajusta y cierra ventas de paisajismo en tiempo real frente a tus clientes. Sin recargas, sin errores, sin complicaciones.
            </p>
            <Button
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
              className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-8 py-6 text-lg"
            >
              Comenzar Ahora
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            <Card>
              <CardHeader>
                <Zap className="w-8 h-8 text-yellow-500 mb-2" />
                <CardTitle>Rápido</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Flujo completo en menos de 5 minutos. Captura, diseña, ajusta y cierra la venta sin interrupciones.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="w-8 h-8 text-blue-500 mb-2" />
                <CardTitle>Interactivo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Ajusta el diseño en vivo frente al cliente. Mueve plantas, cambia materiales, ve cotización en tiempo real.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="w-8 h-8 text-green-500 mb-2" />
                <CardTitle>Rentable</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Cotización automática con márgenes. Cierra ventas en el momento. Aumenta tu tasa de conversión.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Workflow */}
          <div className="bg-white rounded-lg p-12 mb-20">
            <h3 className="text-3xl font-bold text-gray-900 mb-12 text-center">
              El Flujo Completo
            </h3>
            <div className="grid md:grid-cols-6 gap-4">
              {[
                { num: 1, title: "Captura", desc: "Foto del terreno" },
                { num: 2, title: "Análisis", desc: "Detecta zonas" },
                { num: 3, title: "Diseño", desc: "Propuesta automática" },
                { num: 4, title: "Ajuste", desc: "Edición en vivo" },
                { num: 5, title: "Presentación", desc: "Muestra al cliente" },
                { num: 6, title: "Confirmación", desc: "Cierra la venta" },
              ].map((step, idx) => (
                <div key={idx} className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                    {step.num}
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">{step.title}</h4>
                  <p className="text-sm text-gray-600">{step.desc}</p>
                  {idx < 5 && (
                    <ArrowRight className="w-4 h-4 text-gray-400 mx-auto mt-4 hidden md:block" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="grid md:grid-cols-2 gap-8 mb-20">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                ¿Por qué LandscapeApp?
              </h3>
              <ul className="space-y-4">
                {[
                  "Cierra ventas en el momento sin esperar",
                  "Ajusta diseños en vivo frente al cliente",
                  "Cotización automática y precisa",
                  "Sin recargas de página",
                  "Funciona en iPad y iPhone",
                  "Historial de versiones",
                  "Modo offline disponible",
                  "Sincronización automática",
                ].map((benefit, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Casos de Uso</CardTitle>
                <CardDescription>
                  Perfecto para vendedores de paisajismo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Visita a Cliente</h4>
                  <p className="text-sm text-gray-600">
                    Captura la foto, diseña en el momento, ajusta según feedback, cierra la venta.
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Seguimiento</h4>
                  <p className="text-sm text-gray-600">
                    Recupera proyecto anterior, muestra cambios, obtén aprobación final.
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Presentación Remota</h4>
                  <p className="text-sm text-gray-600">
                    Comparte propuesta, ajusta en vivo, cierra por video llamada.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-12 text-white">
            <h3 className="text-3xl font-bold mb-4">
              Listo para aumentar tus ventas?
            </h3>
            <p className="text-lg mb-8 opacity-90">
              Comienza a usar LandscapeApp hoy y cierra más ventas en menos tiempo.
            </p>
            <Button
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              Iniciar Sesión
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-12 mt-20">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p>© 2026 LandscapeApp. Todos los derechos reservados.</p>
          </div>
        </footer>
      </div>
    );
  }

  // Usuario autenticado
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">🌿</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">LandscapeApp</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">
              Bienvenido, <strong>{user?.name || "Usuario"}</strong>
            </span>
            <Button variant="outline" onClick={() => window.location.href = "/projects"}>
              Mis Proyectos
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nuevo Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Comienza un nuevo proyecto de paisajismo
              </p>
              <Button
                onClick={() => window.location.href = "/projects/new"}
                className="w-full"
              >
                Crear Proyecto
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mis Proyectos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Continúa con proyectos anteriores
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.href = "/projects"}
                className="w-full"
              >
                Ver Proyectos
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tienda / Inventario</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Gestiona tu catálogo de plantas
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.href = "/inventory"}
                className="w-full"
              >
                Administrar Inventario
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documentación</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Aprende cómo usar LandscapeApp
              </p>
              <Button
                variant="outline"
                onClick={() => alert("Documentación disponible en README.md")}
                className="w-full"
              >
                Leer Docs
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Guía rápida */}
        <Card>
          <CardHeader>
            <CardTitle>Guía Rápida</CardTitle>
            <CardDescription>
              Cómo usar el sistema de diseño de paisajismo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Pasos del Flujo</h4>
                <ol className="space-y-2 text-sm text-gray-600">
                  <li>1. <strong>Captura:</strong> Toma foto del terreno</li>
                  <li>2. <strong>Análisis:</strong> Sistema detecta zonas</li>
                  <li>3. <strong>Diseño:</strong> Genera propuesta automática</li>
                  <li>4. <strong>Ajuste:</strong> Edita en vivo frente al cliente</li>
                  <li>5. <strong>Presentación:</strong> Muestra cotización</li>
                  <li>6. <strong>Confirmación:</strong> Cierra la venta</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Características Clave</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>✓ Flujo completo en menos de 5 minutos</li>
                  <li>✓ Edición en vivo sin recargas</li>
                  <li>✓ Cotización automática en tiempo real</li>
                  <li>✓ Historial de versiones</li>
                  <li>✓ Modo offline disponible</li>
                  <li>✓ Optimizado para iPad/iPhone</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
