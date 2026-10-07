import logo from "@/assets/logo-gavioes.webp.asset.json";
import logoNeg from "@/assets/logo-gavioes-negativo.webp.asset.json";

export function Logo({ variant = "color", className }: { variant?: "color" | "negative"; className?: string }) {
  return (
    <img
      src={variant === "negative" ? logoNeg.url : logo.url}
      alt="Academia Gaviões"
      className={className ?? "h-12 w-auto"}
    />
  );
}
