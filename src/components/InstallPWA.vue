<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  delay: { type: Number, default: 3000 },
  storageKey: {
    type: String,
    default: "na_portal_pwa_install_prompt_seen",
  },
  userKey: { type: String, default: "" },
  iconSrc: { type: String, default: "/favicon.svg" },
  title: {
    type: String,
    default: "Tenha uma experiência melhor instalando nosso app 🚀",
  },
  ctaLabel: { type: String, default: "Instalar agora" },
});

const deferredPrompt = ref(null);
const visible = ref(false);
const installing = ref(false);
const installMode = ref("native");
const iosManual = ref(false);
const supportText = computed(
  () =>
    installMode.value === "ios-manual"
      ? "No iPhone, adicione o portal na Tela de Início para abrir como app e entrar mais rápido."
      : "Abra o portal com acesso direto na tela inicial e experiencia mais fluida no celular.",
);
const showNativeInstallButton = computed(
  () => installMode.value === "native" && !!deferredPrompt.value,
);

let revealTimer = 0;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIosDevice() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  );
}

function clearRevealTimer() {
  if (!revealTimer) return;
  window.clearTimeout(revealTimer);
  revealTimer = 0;
}

function storageKeys() {
  const user = String(props.userKey || "").trim();
  return user
    ? [`${props.storageKey}:${user}`, props.storageKey]
    : [props.storageKey];
}

function wasShown() {
  if (typeof window === "undefined") return true;
  return storageKeys().some((key) => localStorage.getItem(key) === "1");
}

function markShown() {
  if (typeof window === "undefined") return;
  const user = String(props.userKey || "").trim();
  const key = user ? `${props.storageKey}:${user}` : props.storageKey;
  localStorage.setItem(key, "1");
}

function hideBanner({ clearPrompt = false } = {}) {
  clearRevealTimer();
  visible.value = false;
  installing.value = false;
  if (clearPrompt) deferredPrompt.value = null;
}

function resolveInstallMode() {
  if (deferredPrompt.value) return "native";
  if (iosManual.value) return "ios-manual";
  return "none";
}

function scheduleReveal() {
  const nextMode = resolveInstallMode();
  if (nextMode === "none" || isStandalone() || wasShown()) {
    hideBanner({ clearPrompt: isStandalone() || wasShown() });
    return;
  }

  installMode.value = nextMode;
  clearRevealTimer();
  revealTimer = window.setTimeout(() => {
    const currentMode = resolveInstallMode();
    if (currentMode === "none" || isStandalone() || wasShown()) return;
    installMode.value = currentMode;
    markShown();
    visible.value = true;
  }, props.delay);
}

async function installApp() {
  const promptEvent = deferredPrompt.value;
  if (!promptEvent) return;

  installing.value = true;
  visible.value = false;
  deferredPrompt.value = null;

  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === "accepted") markShown();
  } finally {
    hideBanner({ clearPrompt: true });
  }
}

function dismissBanner() {
  markShown();
  hideBanner({ clearPrompt: true });
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  if (isStandalone() || wasShown()) return;
  deferredPrompt.value = event;
  scheduleReveal();
}

function handleAppInstalled() {
  markShown();
  hideBanner({ clearPrompt: true });
}

watch(
  () => props.userKey,
  () => {
    if (wasShown()) {
      hideBanner({ clearPrompt: true });
      return;
    }
    if (!visible.value && resolveInstallMode() !== "none") scheduleReveal();
  },
);

onMounted(() => {
  if (typeof window === "undefined" || isStandalone()) return;
  iosManual.value = isIosDevice();
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
  if (iosManual.value && !wasShown()) scheduleReveal();
});

onBeforeUnmount(() => {
  clearRevealTimer();
  if (typeof window === "undefined") return;
  window.removeEventListener(
    "beforeinstallprompt",
    handleBeforeInstallPrompt,
  );
  window.removeEventListener("appinstalled", handleAppInstalled);
});
</script>

<template>
  <Transition name="install-pwa">
    <aside
      v-if="visible"
      class="install-pwa"
      role="region"
      aria-label="Instalar aplicativo no dispositivo"
    >
      <div class="install-pwa__brand">
        <div class="install-pwa__logo">
          <img :src="iconSrc" alt="Flashrub" loading="lazy" />
        </div>
        <div class="install-pwa__copy">
          <strong>{{ title }}</strong>
          <p>{{ supportText }}</p>
        </div>
      </div>

      <div v-if="installMode === 'ios-manual'" class="install-pwa__ios-help">
        <div class="install-pwa__ios-step">
          <span class="install-pwa__ios-index">1</span>
          <span>
            Toque em <fa icon="share-nodes" /> Compartilhar no navegador.
          </span>
        </div>
        <div class="install-pwa__ios-step">
          <span class="install-pwa__ios-index">2</span>
          <span>Escolha “Adicionar à Tela de Início”.</span>
        </div>
      </div>

      <div class="install-pwa__actions">
        <button
          v-if="showNativeInstallButton"
          class="install-pwa__cta"
          type="button"
          :disabled="installing"
          @click="installApp"
        >
          <fa :icon="installing ? 'spinner' : 'bolt'" :spin="installing" />
          {{ installing ? "Abrindo..." : ctaLabel }}
        </button>

        <button
          class="install-pwa__dismiss"
          type="button"
          aria-label="Fechar banner de instalacao"
          @click="dismissBanner"
        >
          <fa icon="xmark" />
        </button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.install-pwa {
  position: fixed;
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom));
  z-index: 45;
  width: min(calc(100vw - 24px), 560px);
  transform: translateX(-50%);
  border-radius: 24px;
  padding: 16px;
  background:
    radial-gradient(circle at top left, rgba(124, 92, 255, 0.28), transparent 45%),
    linear-gradient(135deg, #111111, #000000);
  color: #ffffff;
  box-shadow: 0 24px 50px rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: grid;
  gap: 14px;
}

.install-pwa__brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.install-pwa__logo {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.08);
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.install-pwa__logo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.install-pwa__copy {
  min-width: 0;
}

.install-pwa__copy strong {
  display: block;
  font-size: 16px;
  line-height: 1.35;
}

.install-pwa__copy p {
  margin: 6px 0 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  line-height: 1.5;
}

.install-pwa__ios-help {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.install-pwa__ios-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.9);
}

.install-pwa__ios-index {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, #7c5cff, #22d3ee);
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
}

.install-pwa__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}

.install-pwa__cta,
.install-pwa__dismiss {
  border: 0;
  cursor: pointer;
}

.install-pwa__cta {
  flex: 1;
  min-height: 46px;
  border-radius: 16px;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: linear-gradient(135deg, #7c5cff, #22d3ee);
  color: #ffffff;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(34, 211, 238, 0.2);
}

.install-pwa__cta:disabled {
  opacity: 0.78;
  cursor: wait;
}

.install-pwa__dismiss {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.install-pwa-enter-active,
.install-pwa-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.install-pwa-enter-from,
.install-pwa-leave-to {
  opacity: 0;
  transform: translate(-50%, 16px);
}

@media (max-width: 640px) {
  .install-pwa {
    width: min(calc(100vw - 20px), 560px);
    border-radius: 22px;
    padding: 14px;
  }

  .install-pwa__brand,
  .install-pwa__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .install-pwa__logo {
    width: 52px;
    height: 52px;
    border-radius: 16px;
  }

  .install-pwa__dismiss,
  .install-pwa__cta {
    width: 100%;
  }
}
</style>