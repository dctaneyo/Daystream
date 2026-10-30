const STORAGE_KEY = "daystream-theme";

/**
 * Runs before the app paints so the correct theme is applied on the first frame.
 * Kept inline (not a module import) to avoid a round-trip and any flash of the
 * wrong theme.
 */
const SCRIPT = `(function(){try{
var stored=localStorage.getItem("${STORAGE_KEY}");
var theme=(stored==="light"||stored==="dark")?stored:"system";
var dark=theme==="dark"||(theme==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var root=document.documentElement;
root.classList.toggle("dark",dark);
root.dataset.theme=theme;
root.style.colorScheme=dark?"dark":"light";
var meta=document.querySelector('meta[name="theme-color"]');
if(meta){meta.setAttribute("content",dark?"#08090b":"#fbfbfd");}
}catch(e){}})();`;

export function ThemeScript() {
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
