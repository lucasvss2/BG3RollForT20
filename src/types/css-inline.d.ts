/**
 * Type declaration for Vite's ?inline CSS import.
 * Allows: import styles from "./file.css?inline";
 * Vite embeds the CSS as a plain string in the bundle — zero runtime overhead.
 */
declare module "*.css?inline" {
    const css: string;
    export default css;
}
