"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";

export interface PhotoChoice {
  type: string;
  title: string;
  hint: string;
}

interface PhotoUploaderProps {
  choices: PhotoChoice[];
  value: Record<string, File | undefined>;
  onChange: (type: string, file: File | undefined) => void;
  disabled?: boolean;
}

const PHOTO_READ_ERROR = "Could not read the photo. Please choose another image.";

async function loadPhotoImage(file: File): Promise<HTMLImageElement> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(PHOTO_READ_ERROR));
      image.src = imageUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function validatePhoto(file: File): Promise<void> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("JPEG, PNG, or WebP photos only.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("Photo must be smaller than 10 MB.");

  const image = await loadPhotoImage(file);
  if (image.naturalWidth < 240 || image.naturalHeight < 240) throw new Error("Retake the photo; it is blurry.");
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context) {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const luminance = new Float32Array(canvas.width * canvas.height);
    for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
      luminance[pixel] = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
    }
    let edgeSum = 0;
    let edgeSquares = 0;
    let samples = 0;
    for (let y = 1; y < canvas.height - 1; y += 1) {
      for (let x = 1; x < canvas.width - 1; x += 1) {
        const position = y * canvas.width + x;
        const laplacian = 4 * luminance[position] - luminance[position - 1] -
          luminance[position + 1] - luminance[position - canvas.width] -
          luminance[position + canvas.width];
        edgeSum += laplacian;
        edgeSquares += laplacian * laplacian;
        samples += 1;
      }
    }
    const variance = edgeSquares / samples - (edgeSum / samples) ** 2;
    if (variance < 22) throw new Error("The photo is blurry. Please retake it.");
  }
}

export function PhotoUploader({ choices, value, onChange, disabled = false }: PhotoUploaderProps) {
  const { t } = useLanguage();
  const [active, setActive] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const urls = useMemo(() => Object.fromEntries(
    Object.entries(value).flatMap(([type, file]) => file ? [[type, URL.createObjectURL(file)]] : []),
  ), [value]);

  useEffect(() => () => Object.values(urls).forEach(URL.revokeObjectURL), [urls]);

  async function choose(type: string, file?: File) {
    if (!file) return;
    setActive(type);
    setErrors((previous) => ({ ...previous, [type]: "" }));
    setProgress((previous) => ({ ...previous, [type]: 16 }));
    try {
      await validatePhoto(file);
      setProgress((previous) => ({ ...previous, [type]: 74 }));
      onChange(type, file);
      setProgress((previous) => ({ ...previous, [type]: 100 }));
    } catch (error) {
      const message = error instanceof Error ? error.message : PHOTO_READ_ERROR;
      setErrors((previous) => ({ ...previous, [type]: t(message) }));
      onChange(type, undefined);
      setProgress((previous) => ({ ...previous, [type]: 0 }));
    } finally {
      setActive(null);
    }
  }

  return (
    <div className="photo-grid">
      {choices.map((choice, index) => (
        <motion.label
          key={choice.type}
          className={`photo-upload ${dragging === choice.type ? "is-dragging" : ""} ${errors[choice.type] ? "has-error" : ""}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04 }}
          onDragOver={(event) => { event.preventDefault(); setDragging(choice.type); }}
          onDragLeave={() => setDragging(null)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(null);
            void choose(choice.type, event.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={disabled || active !== null}
            onChange={(event) => {
              void choose(choice.type, event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <div className="photo-preview">
            {urls[choice.type] ? (
              <Image src={urls[choice.type]} alt={`${choice.title} preview`} width={62} height={53} unoptimized />
            ) : (
              <span className="photo-plus" aria-hidden="true">+</span>
            )}
            <AnimatePresence>
              {active === choice.type && (
                <motion.span
                  className="upload-shimmer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ width: `${progress[choice.type] ?? 16}%` }}
                />
              )}
              {value[choice.type] && active !== choice.type && (
                <motion.span className="photo-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className="photo-title">{t(choice.title)}</span>
          <span className="photo-hint">{t(choice.hint)}</span>
          {errors[choice.type] && <span className="field-error" role="alert">{t(errors[choice.type])}</span>}
        </motion.label>
      ))}
    </div>
  );
}
