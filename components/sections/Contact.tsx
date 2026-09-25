"use client";

import { useRef, useState, type FormEvent } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { CONTACT, LINKS } from "@/lib/content";
import { useTilt } from "@/lib/useTilt";
import { ArrowRight, Check, Mail } from "../ui/Icons";

type Status = "idle" | "sending" | "sent" | "error";

const FIELDS = [
  { name: "name", label: "Namn", placeholder: "Anna Andersson", type: "text", autoComplete: "name", required: true },
  {
    name: "email",
    label: "E-post",
    placeholder: "anna@foretag.se",
    type: "email",
    autoComplete: "email",
    required: true,
  },
  { name: "phone", label: "Telefon", placeholder: "070-123 45 67", type: "tel", autoComplete: "tel" },
  { name: "city", label: "Ort", placeholder: "Göteborg", type: "text", autoComplete: "address-level2" },
  {
    name: "company",
    label: "Företagsnamn",
    placeholder: "Anderssons Rör AB",
    type: "text",
    autoComplete: "organization",
  },
] as const;

/**
 * Posts to the platform's /api/leads (same payload as the current site) and
 * falls back to a pre-filled e-mail to hej@kleo.se if that fails.
 */
export default function Contact() {
  const root = useRef<HTMLElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  useTilt(tilt, 4);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(".contact-copy > *", {
          y: 50,
          opacity: 0,
          stagger: 0.1,
          duration: 1.1,
          ease: "expo.out",
          scrollTrigger: { trigger: root.current, start: "top 75%" },
        });
        gsap.fromTo(
          ".contact-form",
          { rotateY: -28, rotateX: 10, z: -200, opacity: 0 },
          {
            rotateY: 0,
            rotateX: 0,
            z: 0,
            opacity: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: ".contact-form", start: "top 95%", end: "top 45%", scrub: 1 },
          },
        );
      });
    },
    { scope: root },
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const message = [data.message, data.city ? `Ort: ${data.city}` : ""].filter(Boolean).join("\n\n");
    setStatus("sending");
    try {
      const res = await fetch(LINKS.leads, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          employees: data.employees,
          message,
          website: data.website,
          source: "marketing-3d",
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("sent");
    } catch {
      setStatus("error");
      const body = [
        `Namn: ${data.name}`,
        `E-post: ${data.email}`,
        data.phone && `Telefon: ${data.phone}`,
        data.company && `Företag: ${data.company}`,
        data.employees && `Antal anställda: ${data.employees}`,
        message,
      ]
        .filter(Boolean)
        .join("\n");
      window.location.href = `mailto:${LINKS.email}?subject=${encodeURIComponent("Kontakt från kleo.se")}&body=${encodeURIComponent(body)}`;
    }
  }

  return (
    <section ref={root} id="kontakt" className="relative py-24 md:py-36" aria-labelledby="contact-title">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 md:grid-cols-2 md:gap-16 md:px-8">
        <div className="contact-copy">
          <p className="eyebrow text-blue">{CONTACT.eyebrow}</p>
          <h2 id="contact-title" className="headline mt-5 text-[clamp(2.6rem,6vw,5rem)]">
            {CONTACT.title}
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">{CONTACT.body}</p>
          <a
            href={`mailto:${LINKS.email}`}
            className="mt-8 inline-flex items-center gap-2 font-medium text-ink hover:text-blue"
          >
            <Mail /> {LINKS.email}
          </a>
        </div>

        <div className="[perspective:1400px]">
          <div className="contact-form preserve-3d">
            <div ref={tilt} className="card preserve-3d p-6 md:p-8">
              {status === "sent" ? (
                <div className="flex min-h-[28rem] flex-col items-center justify-center text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-blue text-white">
                    <Check size={26} />
                  </span>
                  <p className="headline mt-6 text-3xl">Tack! Vi hör av oss.</p>
                  <p className="mt-3 text-ink-2">{CONTACT.note}</p>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
                  {FIELDS.map((f) => (
                    <label key={f.name} className="grid gap-1.5 text-sm font-medium">
                      {f.label}
                      <input
                        className="field"
                        name={f.name}
                        type={f.type}
                        placeholder={f.placeholder}
                        autoComplete={f.autoComplete}
                        required={"required" in f && f.required}
                      />
                    </label>
                  ))}
                  <label className="grid gap-1.5 text-sm font-medium">
                    Antal anställda
                    <select className="field appearance-none" name="employees" defaultValue="">
                      <option value="" disabled>
                        Välj…
                      </option>
                      {CONTACT.employees.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                    Vad vill du prata om?
                    <textarea className="field" name="message" placeholder="Berätta kort vad du vill ha hjälp med" />
                  </label>
                  {/* Honeypot, same field name as the platform expects */}
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                  <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-ink-3">
                      {status === "error" ? `Det gick inte att skicka. Mejla oss på ${LINKS.email}.` : CONTACT.note}
                    </p>
                    <button type="submit" className="btn btn-primary" disabled={status === "sending"}>
                      {status === "sending" ? "Skickar…" : CONTACT.submit}
                      <ArrowRight className="arrow" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
