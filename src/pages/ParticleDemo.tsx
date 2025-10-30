import { ParticleTextEffect } from "@/components/ui/particle-text-effect";

export default function ParticleDemo() {
  const celebrationWords = [
    "SUCCESS!",
    "EXTRACTED",
    "MESH AI",
    "COMPLETE",
    "AMAZING"
  ];

  return (
    <div className="min-h-screen">
      <ParticleTextEffect 
        words={celebrationWords}
        className="min-h-screen"
        width={1200}
        height={600}
      />
    </div>
  );
}
