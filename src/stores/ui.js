import { defineStore } from 'pinia';

let id = 0;

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [],
    sidebarAberta: false,
  }),
  actions: {
    toast(mensagem, tipo = 'info', timeout = 3500) {
      const t = { id: ++id, mensagem, tipo };
      this.toasts.push(t);
      setTimeout(() => this.dismiss(t.id), timeout);
    },
    sucesso(m) { this.toast(m, 'ok'); },
    erro(m) { this.toast(m, 'err', 5000); },
    info(m) { this.toast(m, 'info'); },
    dismiss(tid) { this.toasts = this.toasts.filter((x) => x.id !== tid); },
    toggleSidebar() { this.sidebarAberta = !this.sidebarAberta; },
    fecharSidebar() { this.sidebarAberta = false; },
  },
});
