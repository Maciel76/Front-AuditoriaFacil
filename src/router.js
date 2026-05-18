import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/Login.vue"),
    meta: { publica: true },
  },
  {
    path: "/portal",
    name: "portal",
    component: () => import("@/views/ColaboradorPortal.vue"),
    meta: { publica: true },
  },
  {
    path: "/",
    component: () => import("@/layouts/AppLayout.vue"),
    meta: { auth: true },
    children: [
      { path: "", redirect: "/dashboard" },
      {
        path: "dashboard",
        name: "dashboard",
        component: () => import("@/views/Dashboard.vue"),
      },
      {
        path: "lojas",
        name: "lojas",
        component: () => import("@/views/Lojas.vue"),
      },
      {
        path: "lojas/:id",
        name: "loja-perfil",
        component: () => import("@/views/LojaPerfil.vue"),
      },
      {
        path: "auditorias",
        name: "auditorias",
        component: () => import("@/views/Auditorias.vue"),
      },
      {
        path: "auditorias/:id",
        name: "auditoria-detalhe",
        component: () => import("@/views/AuditoriaDetalhe.vue"),
      },
      {
        path: "rankings",
        redirect: "/rankings/colaboradores",
      },
      {
        path: "rankings/colaboradores",
        name: "ranking-colaboradores",
        component: () => import("@/views/RankingColaboradores.vue"),
        meta: { roles: ["SUPER_ADMIN", "STORE_ADMIN"] },
      },
      {
        path: "rankings/lojas",
        name: "ranking-lojas",
        component: () => import("@/views/RankingLojas.vue"),
        meta: { roles: ["SUPER_ADMIN", "STORE_ADMIN"] },
      },
      {
        path: "colaboradores",
        name: "colaboradores",
        component: () => import("@/views/Colaboradores.vue"),
      },
      {
        path: "colaboradores/:id",
        name: "colaborador-perfil",
        component: () => import("@/views/ColaboradorPerfil.vue"),
      },
      {
        path: "relatorios",
        name: "relatorios",
        component: () => import("@/views/Relatorios.vue"),
      },
      {
        path: "configuracoes",
        name: "configuracoes",
        component: () => import("@/views/Configuracoes.vue"),
      },
      {
        path: "admin/lojas",
        name: "admin-lojas",
        component: () => import("@/views/AdminLojas.vue"),
        meta: { roles: ["SUPER_ADMIN"] },
      },
      {
        path: "admin/conquistas",
        name: "admin-conquistas",
        component: () => import("@/views/AdminConquistas.vue"),
        meta: { roles: ["SUPER_ADMIN"] },
      },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta?.auth && !auth.autenticado)
    return { name: "login", query: { redirect: to.fullPath } };
  if (to.meta?.publica && auth.autenticado && to.name === "login")
    return { name: "dashboard" };
  if (to.meta?.roles && !to.meta.roles.includes(auth.usuario?.role))
    return { name: "dashboard" };
  return true;
});
