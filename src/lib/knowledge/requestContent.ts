export interface RequestContentInput {
  needed_info: string;
  background: string;
  delivery_conditions?: string;
  notes?: string;
}

export interface NormalizedRequestContent {
  needed_info: string;
  background: string;
  delivery_conditions: string;
  notes: string;
}

function trimValue(value: string | undefined): string {
  return (value ?? "").trim();
}

export function normalizeRequestContent(
  input: RequestContentInput
): NormalizedRequestContent {
  return {
    needed_info: trimValue(input.needed_info),
    background: trimValue(input.background),
    delivery_conditions: trimValue(input.delivery_conditions),
    notes: trimValue(input.notes),
  };
}

export function buildRequestPreviewContent(
  content: NormalizedRequestContent
): string {
  return content.needed_info;
}

export function buildRequestFullContent(
  content: NormalizedRequestContent
): string {
  const sections: string[] = [
    "## 必要な情報",
    content.needed_info,
    "",
    "## 用途・背景",
    content.background,
  ];

  if (content.delivery_conditions) {
    sections.push("", "## 納品条件", content.delivery_conditions);
  }

  if (content.notes) {
    sections.push("", "## 補足", content.notes);
  }

  return sections.join("\n").trim();
}

export function parseRequestFullContent(
  fullContent: string | null | undefined
): RequestContentInput {
  const source = (fullContent ?? "").trim();
  const parsed: RequestContentInput = {
    needed_info: "",
    background: "",
    delivery_conditions: "",
    notes: "",
  };

  if (!source) return parsed;

  const sectionRegex =
    /##\s*(必要な情報|用途・背景|納品条件|補足)\s*\n([\s\S]*?)(?=\n##\s*(?:必要な情報|用途・背景|納品条件|補足)\s*\n|$)/g;

  for (const match of source.matchAll(sectionRegex)) {
    const heading = match[1];
    const body = (match[2] ?? "").trim();

    if (heading === "必要な情報") parsed.needed_info = body;
    if (heading === "用途・背景") parsed.background = body;
    if (heading === "納品条件") parsed.delivery_conditions = body;
    if (heading === "補足") parsed.notes = body;
  }

  if (!parsed.needed_info && !parsed.background) {
    parsed.needed_info = source;
  }

  return parsed;
}
