import { ACTIVE_KEY } from './storage';

/**
 * Runs in <head> before the first paint: injects the saved theme CSS so a non-default palette never
 * flashes the default green first. Same idea as LOCALE_SCRIPT in i18n/config.ts. The stylesheet it adds is
 * replaced by the React side (AppearanceSync) once the app has loaded the same preferences.
 */
export const THEME_SCRIPT = `(function(){try{var a=JSON.parse(localStorage.getItem(${JSON.stringify(ACTIVE_KEY)})||"null");if(a&&typeof a.css==="string"){var s=document.createElement("style");s.id="erp-theme";s.textContent=a.css;document.head.appendChild(s);document.documentElement.dataset.palette=a.id}}catch(e){}})()`;
