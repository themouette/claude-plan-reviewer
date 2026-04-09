use std::collections::HashSet;

use comrak::{markdown_to_html, Options};

pub fn render_plan_html(markdown: &str) -> String {
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.tasklist = true;
    options.extension.strikethrough = true;
    options.extension.autolink = true;
    // Do NOT set options.render.unsafe_ = true — plan content is sanitized
    let html = markdown_to_html(markdown, &options);

    // Strip javascript: and data: URIs from href/src attributes.
    // comrak's unsafe_=false only blocks raw HTML passthrough; it does NOT
    // filter href values emitted from markdown link syntax. ammonia enforces
    // a strict URL scheme allowlist on all href and src attributes.
    ammonia::Builder::new()
        .url_schemes(HashSet::from(["https", "http", "mailto"]))
        .clean(&html)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn javascript_uri_is_stripped() {
        let output = render_plan_html("[xss](javascript:alert(1))");
        assert!(
            !output.contains("javascript:"),
            "Expected javascript: to be stripped, but got: {output}"
        );
    }

    #[test]
    fn data_uri_is_stripped() {
        let output = render_plan_html("[data](data:text/html,<h1>hi</h1>)");
        assert!(
            !output.contains("data:"),
            "Expected data: to be stripped, but got: {output}"
        );
    }

    #[test]
    fn https_link_is_preserved() {
        let output = render_plan_html("[ok](https://example.com)");
        assert!(
            output.contains("href=\"https://example.com\""),
            "Expected href=\"https://example.com\" to be present, but got: {output}"
        );
    }

    #[test]
    fn mailto_link_is_preserved() {
        let output = render_plan_html("[mail](mailto:a@b.com)");
        assert!(
            output.contains("href=\"mailto:a@b.com\""),
            "Expected href=\"mailto:a@b.com\" to be present, but got: {output}"
        );
    }

    #[test]
    fn http_link_is_preserved() {
        let output = render_plan_html("[plain](http://example.com)");
        assert!(
            output.contains("href=\"http://example.com\""),
            "Expected href=\"http://example.com\" to be present, but got: {output}"
        );
    }
}
