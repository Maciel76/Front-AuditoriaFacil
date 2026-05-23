<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import StoreAvatar from "@/components/StoreAvatar.vue";

const auth = useAuthStore();
const ui = useUiStore();
const route = useRoute();
const router = useRouter();
let resizeHandler;

const navegacao = computed(() => {
  const base = [
    { to: "/dashboard", label: "Dashboard", ico: "gauge" },
    { to: "/lojas", label: "Lojas", ico: "store" },
    { to: "/auditorias", label: "Auditorias", ico: "clipboard-check" },
    { to: "/colaboradores", label: "Colaboradores", ico: "users" },
    { to: "/relatorios", label: "Relatórios", ico: "file-lines" },
    { to: "/configuracoes", label: "Configurações", ico: "gear" },
  ];
  if (auth.podeGerenciar) {
    base.splice(3, 0, {
      to: "/rankings/colaboradores",
      label: "Ranking colaboradores",
      ico: "users",
    });
    base.splice(4, 0, {
      to: "/rankings/lojas",
      label: "Ranking lojas",
      ico: "ranking-star",
    });
  }
  if (auth.isSuperAdmin) {
    base.push({
      to: "/admin/lojas",
      label: "Admin lojas",
      ico: "gear",
      sup: true,
    });
    base.push({
      to: "/admin/conquistas",
      label: "Conquistas",
      ico: "trophy",
      sup: true,
    });
  }
  return base;
});

const titulo = computed(() => {
  const m = {
    dashboard: "Visão geral",
    lojas: "Lojas",
    "loja-perfil": "Perfil da loja",
    auditorias: "Auditorias",
    "auditoria-detalhe": "Detalhe da auditoria",
    "ranking-colaboradores": "Ranking de colaboradores",
    "ranking-lojas": "Ranking de lojas",
    colaboradores: "Colaboradores",
    "colaborador-perfil": "Perfil do colaborador",
    relatorios: "Relatórios",
    configuracoes: "Configurações",
    "admin-lojas": "Administração de lojas",
    "admin-conquistas": "Conquistas e gamificação",
  };
  return m[route.name] || "Flashrub";
});

const iniciais = computed(() => {
  const n = auth.usuario?.nome || "?";
  return n
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
});

function sair() {
  auth.logout();
  router.push("/login");
}

const diaSemana = new Date().getDay();

function aplicarTema(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("na_tema", t);
}
function toggleTema() {
  const atual = document.documentElement.getAttribute("data-theme") || "dark";
  aplicarTema(atual === "dark" ? "light" : "dark");
}
const isDark = computed(
  () =>
    (document.documentElement.getAttribute("data-theme") || "dark") === "dark",
);

function sincronizarSidebarMobile() {
  const mobile = window.innerWidth <= 900;
  document.body.classList.toggle("sidebar-open", mobile && ui.sidebarAberta);
  if (!mobile) ui.fecharSidebar();
}

watch(
  () => route.fullPath,
  () => ui.fecharSidebar(),
);
watch(
  () => ui.sidebarAberta,
  () => sincronizarSidebarMobile(),
);

onMounted(() => {
  const salvo = localStorage.getItem("na_tema") || "dark";
  aplicarTema(salvo);

  resizeHandler = () => sincronizarSidebarMobile();
  window.addEventListener("resize", resizeHandler);
  sincronizarSidebarMobile();
});

onBeforeUnmount(() => {
  document.body.classList.remove("sidebar-open");
  if (resizeHandler) window.removeEventListener("resize", resizeHandler);
});
</script>

<template>
  <div class="app-shell">
    <aside
      class="sidebar"
      :class="{ open: ui.sidebarAberta }"
      @click.self="ui.fecharSidebar()"
    >
      <div class="brand">
        <StoreAvatar
          v-if="auth.loja"
          :nome="auth.loja.nome"
          :avatar-url="auth.loja.avatarUrl"
          :size="36"
          :font-size="13"
        />
        <div v-else class="brand-mark"><fa icon="bolt" /></div>
        <div class="brand-name">
          Flashrub
          <small>{{
            auth.loja?.nome ||
            (auth.isSuperAdmin ? "Administração" : "Sem loja")
          }}</small>
        </div>
      </div>

      <RouterLink
        v-for="n in navegacao"
        :key="n.to"
        :to="n.to"
        class="nav-item"
        active-class="active"
        @click="ui.fecharSidebar()"
      >
        <fa class="ico" :icon="n.ico" />
        <span>{{ n.label }}</span>
        <span
          v-if="n.sup"
          class="badge info"
          style="margin-left: auto; font-size: 10px"
          >admin</span
        >
      </RouterLink>

      <div class="sidebar-footer">
        <div class="row" style="padding: 8px 4px">
          <div
            class="avatar"
            :style="
              auth.usuario?.avatarUrl
                ? `background-image:url(${auth.usuario.avatarUrl}); background-size:cover;`
                : ''
            "
          >
            <span v-if="!auth.usuario?.avatarUrl">{{ iniciais }}</span>
          </div>
          <div style="min-width: 0; flex: 1">
            <div
              style="
                font-size: 13px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              "
            >
              {{ auth.usuario?.nome }}
            </div>
            <div class="muted" style="font-size: 11px">
              {{ auth.usuario?.role }}
            </div>
          </div>
          <button
            class="btn ghost"
            title="Alternar tema"
            style="padding: 6px 10px"
            @click.stop="toggleTema"
          >
            <fa :icon="isDark ? 'sun' : 'moon'" />
          </button>
          <button
            class="btn ghost"
            title="Sair"
            style="padding: 6px 10px"
            @click.stop="sair"
          >
            <fa icon="right-from-bracket" />
          </button>
        </div>
      </div>
    </aside>

    <button
      v-if="ui.sidebarAberta"
      class="sidebar-backdrop"
      @click="ui.fecharSidebar()"
      aria-label="Fechar menu lateral"
    ></button>

    <div class="main">
      <header class="topbar">
        <div class="row">
          <button
            class="btn ghost menu-mobile"
            @click="ui.toggleSidebar()"
            aria-label="Abrir menu lateral"
          >
            <fa icon="bars" />
          </button>
          <div>
            <h1>{{ titulo }}</h1>
            <div class="sub muted">
              {{
                new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              }}
            </div>
          </div>
        </div>
        <div class="row gap-2">
          <span
            class="badge tipo-ETIQUETA"
            v-if="diaSemana === 1 || diaSemana === 4"
          >
            <fa icon="calendar" /> Hoje: Etiqueta
          </span>
          <span class="badge tipo-PRESENCA" v-else-if="diaSemana === 2">
            <fa icon="calendar" /> Hoje: Presença
          </span>
          <span class="badge tipo-RUPTURA" v-else-if="diaSemana === 3">
            <fa icon="calendar" /> Hoje: Ruptura
          </span>
          <RouterLink
            to="/portal"
            class="btn ghost"
            style="white-space: nowrap; font-size: 14px;"
          >
            <fa icon="id-badge" /> Portal colaboradores
          </RouterLink>
          <RouterLink
            v-if="auth.podeGerenciar"
            to="/auditorias"
            class="btn primary topbar-upload-btn"
            style="white-space: nowrap; font-size: 14px;"
          >
            <fa icon="cloud-arrow-up" /> Enviar planilha
          </RouterLink>
        </div>
      </header>

      <main class="content">
        <RouterView v-slot="{ Component, route: r }">
          <component :is="Component" :key="r.fullPath" />
        </RouterView>
      </main>
    </div>
  </div>
</template>
