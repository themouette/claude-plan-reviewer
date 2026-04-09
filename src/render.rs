use comrak::{markdown_to_html, Options};

pub fn render_plan_html(markdown: &str) -> String {
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.tasklist = true;
    options.extension.strikethrough = true;
    options.extension.autolink = true;
    // Do NOT set options.render.unsafe_ = true — plan content is sanitized
    markdown_to_html(markdown, &options)
}
