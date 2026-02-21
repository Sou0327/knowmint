"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { translateJaToEn } from "@/lib/i18n/jaToEn";

const TRANSLATABLE_ATTRIBUTES = ["placeholder", "aria-label", "title", "alt"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);

function shouldSkipNode(textNode: Text): boolean {
  const parent = textNode.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest("[data-i18n-skip='true']")) return true;
  return false;
}

function translateTextByLocale(source: string, locale: "ja" | "en"): string {
  if (locale === "ja") return source;
  return translateJaToEn(source);
}

export default function LocaleAutoTranslator() {
  const { locale } = useI18n();
  const localeRef = useRef(locale);
  const textOriginalsRef = useRef(new WeakMap<Text, string>());
  const attrOriginalsRef = useRef(new WeakMap<Element, Map<string, string>>());
  const applyingRef = useRef(false);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    const processTextNode = (node: Text, currentLocale: "ja" | "en") => {
      if (shouldSkipNode(node)) return;

      const currentValue = node.nodeValue ?? "";
      const textOriginals = textOriginalsRef.current;
      const storedSource = textOriginals.get(node);

      if (storedSource === undefined) {
        textOriginals.set(node, currentValue);
      } else {
        const expectedFromStored = translateTextByLocale(storedSource, currentLocale);
        if (currentValue !== expectedFromStored) {
          textOriginals.set(node, currentValue);
        }
      }

      const source = textOriginals.get(node) ?? "";
      const translated = translateTextByLocale(source, currentLocale);
      if (currentValue !== translated) {
        node.nodeValue = translated;
      }
    };

    const processElementAttributes = (element: Element, currentLocale: "ja" | "en") => {
      if (element.closest("[data-i18n-skip='true']")) return;

      const attrOriginals = attrOriginalsRef.current;
      let originalMap = attrOriginals.get(element);
      if (!originalMap) {
        originalMap = new Map();
        attrOriginals.set(element, originalMap);
      }

      for (const attr of TRANSLATABLE_ATTRIBUTES) {
        const currentValue = element.getAttribute(attr);
        if (currentValue === null) continue;

        const storedSource = originalMap.get(attr);
        if (storedSource === undefined) {
          originalMap.set(attr, currentValue);
        } else {
          const expectedFromStored = translateTextByLocale(storedSource, currentLocale);
          if (currentValue !== expectedFromStored) {
            originalMap.set(attr, currentValue);
          }
        }

        const source = originalMap.get(attr) ?? currentValue;
        const translated = translateTextByLocale(source, currentLocale);
        if (currentValue !== translated) {
          element.setAttribute(attr, translated);
        }
      }
    };

    const processSubtree = (root: Node, currentLocale: "ja" | "en") => {
      if (root.nodeType === Node.TEXT_NODE) {
        processTextNode(root as Text, currentLocale);
        return;
      }

      if (root.nodeType !== Node.ELEMENT_NODE) return;

      const rootElement = root as Element;
      processElementAttributes(rootElement, currentLocale);

      const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_TEXT,
        null
      );

      let next = walker.nextNode();
      while (next) {
        processTextNode(next as Text, currentLocale);
        next = walker.nextNode();
      }

      rootElement.querySelectorAll("*").forEach((element) => {
        processElementAttributes(element, currentLocale);
      });
    };

    const run = (root: Node = document.body) => {
      applyingRef.current = true;
      try {
        processSubtree(root, localeRef.current);
      } finally {
        applyingRef.current = false;
      }
    };

    run(document.body);

    const observer = new MutationObserver((mutations) => {
      if (applyingRef.current) return;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => run(node));
        } else if (mutation.type === "characterData") {
          run(mutation.target);
        } else if (
          mutation.type === "attributes" &&
          mutation.target instanceof Element
        ) {
          run(mutation.target);
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!document.body) return;
    applyingRef.current = true;
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ALL, null);
      let next: Node | null = walker.currentNode;
      while (next) {
        if (next.nodeType === Node.TEXT_NODE) {
          const text = next as Text;
          const source = textOriginalsRef.current.get(text);
          if (source !== undefined) {
            text.nodeValue = translateTextByLocale(source, locale);
          }
        } else if (next.nodeType === Node.ELEMENT_NODE) {
          const element = next as Element;
          const sourceMap = attrOriginalsRef.current.get(element);
          if (sourceMap) {
            for (const attr of TRANSLATABLE_ATTRIBUTES) {
              const source = sourceMap.get(attr);
              if (source !== undefined) {
                element.setAttribute(attr, translateTextByLocale(source, locale));
              }
            }
          }
        }
        next = walker.nextNode();
      }
    } finally {
      applyingRef.current = false;
    }
  }, [locale]);

  return null;
}
