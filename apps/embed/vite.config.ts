import { defineConfig } from "vite";
import { hosts } from "@postsaver/config";
import { siteConfigPlugin } from "@postsaver/config/vite-plugin";

export default defineConfig({
  plugins: [
    siteConfigPlugin({
      files: () => ({
        // Branch-deployed GitHub Pages: CNAME sets the custom domain, .nojekyll skips Jekyll.
        CNAME: `${hosts.embed}\n`,
        ".nojekyll": "",
        "robots.txt": "User-agent: *\nDisallow: /\n",
      }),
    }),
  ],
});
