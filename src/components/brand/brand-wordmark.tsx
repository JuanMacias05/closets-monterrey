// The BZRS Monterrey wordmark, in the site's serif. "BZRS" in spaced capitals and "Monterrey"
// smaller beside it: the four capitals set tight in this serif read as a blur, and a full-size
// "Monterrey" next to them would not fit the phone header between the menu and the cart.
// Its text is the brand name, so links and headings keep "BZRS Monterrey" as their name.
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.3em] whitespace-nowrap font-serif normal-case ${className}`}>
      <span className="tracking-[0.14em]">BZRS</span>{" "}
      <span className="text-[0.62em] tracking-[0.02em]">Monterrey</span>
    </span>
  );
}
