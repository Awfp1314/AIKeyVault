import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enUS from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";
import jaJP from "./locales/ja-JP.json";
import koKR from "./locales/ko-KR.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      "en-US": {
        translation: enUS,
      },
      "zh-CN": {
        translation: zhCN,
      },
      "ja-JP": {
        translation: jaJP,
      },
      "ko-KR": {
        translation: koKR,
      },
    },
    lng: "zh-CN", // 默认语言
    fallbackLng: "en-US",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false, // 避免suspense边界问题
    },
  });

export default i18n;
