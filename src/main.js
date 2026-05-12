import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import "./styles/global.css";

import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
  faChartLine,
  faUpload,
  faTags,
  faBoxesStacked,
  faTriangleExclamation,
  faGauge,
  faClipboardCheck,
  faTrophy,
  faUsers,
  faFileLines,
  faGear,
  faRightFromBracket,
  faStore,
  faMagnifyingGlass,
  faPlus,
  faMedal,
  faStar,
  faFire,
  faCheck,
  faXmark,
  faCircleInfo,
  faBars,
  faArrowTrendUp,
  faArrowTrendDown,
  faCloudArrowUp,
  faChevronRight,
  faSpinner,
  faTrash,
  faPenToSquare,
  faEye,
  faEyeSlash,
  faFilter,
  faCalendar,
  faShieldHalved,
  faBolt,
  faChartPie,
  faChartBar,
  faRankingStar,
  faAward,
  faSun,
  faMoon,
  faCamera,
  faIdBadge,
  faArrowRight,
  faRightToBracket,
  faUserCircle,
  faLock,
  faUnlock,
  faShareNodes,
} from "@fortawesome/free-solid-svg-icons";

library.add(
  faChartLine,
  faUpload,
  faTags,
  faBoxesStacked,
  faTriangleExclamation,
  faGauge,
  faClipboardCheck,
  faTrophy,
  faUsers,
  faFileLines,
  faGear,
  faRightFromBracket,
  faStore,
  faMagnifyingGlass,
  faPlus,
  faMedal,
  faStar,
  faFire,
  faCheck,
  faXmark,
  faCircleInfo,
  faBars,
  faArrowTrendUp,
  faArrowTrendDown,
  faCloudArrowUp,
  faChevronRight,
  faSpinner,
  faTrash,
  faPenToSquare,
  faEye,
  faEyeSlash,
  faFilter,
  faCalendar,
  faShieldHalved,
  faBolt,
  faChartPie,
  faChartBar,
  faRankingStar,
  faAward,
  faSun,
  faMoon,
  faCamera,
  faIdBadge,
  faArrowRight,
  faRightToBracket,
  faUserCircle,
  faLock,
  faUnlock,
  faShareNodes,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Falha ao registrar o service worker do PWA", error);
    });
  });
}

const app = createApp(App);
app.component("fa", FontAwesomeIcon);
app.use(createPinia());
app.use(router);
app.mount("#app");
