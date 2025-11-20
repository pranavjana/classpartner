"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SplitText from "@/components/SplitText";
import { motion } from "framer-motion";
import {
  Mic,
  MessageSquare,
  Settings,
  Shield,
  Download,
  Zap,
  Brain,
  Lock,
  HelpCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { DotPattern } from "@/components/backgrounds/DotPattern";
import { GridPattern } from "@/components/backgrounds/GridPattern";
import { GradientOrbs } from "@/components/effects/GradientOrbs";
import { ShimmerButton } from "@/components/effects/ShimmerButton";
import { FloatingCard } from "@/components/effects/FloatingCard";
import { RotatingText } from "@/components/text/RotatingText";
import { GradientText } from "@/components/text/GradientText";
import { HighlightOnHover } from "@/components/text/HighlightOnHover";

const features = [
  {
    icon: Mic,
    title: "Real-Time Transcription",
    description:
      "Capture every word with Deepgram-powered accuracy. Live transcription overlay stays on top while you focus on learning.",
    highlights: [
      "Always-on-top overlay",
      "Live & interim results",
      "Manual entry for recording-restricted classes",
    ],
    gradient: "from-orange-500 to-amber-500",
  },
  {
    icon: MessageSquare,
    title: "AI Conversation & Insights",
    description:
      "Ask questions about your lecture in real-time. Get instant answers with rolling summaries, keywords, and action items.",
    highlights: [
      "Ask questions while transcribing",
      "Auto-generated summaries",
      "Smart keyword extraction",
    ],
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    icon: Settings,
    title: "Personalized Learning",
    description:
      "Customize how the AI understands you. Tune system prompts, notes, and learning preferences to match your style.",
    highlights: [
      "Custom system prompts",
      "Adjustable AI cadence",
      "Your data, your way",
    ],
    gradient: "from-yellow-500 to-orange-500",
  },
];

const trustBadges = [
  { icon: Lock, text: "100% Local Processing" },
  { icon: Shield, text: "Privacy First" },
  { icon: Zap, text: "Lightning Fast" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-20">
        {/* Background Effects */}
        <DotPattern
          width={20}
          height={20}
          cx={1}
          cy={1}
          cr={1}
          className="absolute inset-0 h-full w-full text-primary/5"
        />
        <GradientOrbs />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 mx-auto max-w-5xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 backdrop-blur-sm"
          >
            <Sparkles className="h-5 w-5 animate-pulse text-primary" />
            <span className="text-sm font-semibold text-primary">
              Your AI Learning Companion
            </span>
          </motion.div>

          <SplitText
            text="Never Miss a Moment in Class"
            className="mb-8 text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
            delay={50}
            tag="h1"
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mx-auto mb-12 max-w-3xl text-xl text-muted-foreground sm:text-2xl"
          >
            ClassPartner{" "}
            <RotatingText
              words={[
                "transcribes lectures",
                "answers questions",
                "generates summaries",
                "extracts key points",
              ]}
              className="font-semibold text-foreground"
              interval={2500}
            />{" "}
            in real-time and learns how{" "}
            <GradientText className="font-bold">you</GradientText> learn. Focus
            on understanding, not note-taking.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <ShimmerButton className="flex h-14 items-center gap-3 rounded-full bg-primary px-8 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/30">
              <Download className="h-5 w-5" />
              Download for Free
              <ArrowRight className="h-5 w-5" />
            </ShimmerButton>

            <Button
              size="lg"
              variant="outline"
              className="h-14 rounded-full border-2 px-8 text-lg font-semibold"
            >
              Watch Demo
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-8"
          >
            {trustBadges.map((badge, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 + index * 0.1 }}
                className="flex items-center gap-3 rounded-full border border-primary/10 bg-card/50 px-6 py-3 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card"
              >
                <badge.icon className="h-5 w-5 text-primary" />
                <HighlightOnHover className="font-medium text-foreground">
                  {badge.text}
                </HighlightOnHover>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.6 }}
          className="absolute bottom-10 z-10 flex flex-col items-center gap-2 text-muted-foreground"
        >
          <span className="text-sm font-medium">Scroll to explore</span>
          <svg
            className="h-6 w-6 animate-bounce"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="relative px-4 py-32">
        <GridPattern
          width={50}
          height={50}
          className="absolute inset-0 h-full w-full text-primary/5"
        />

        <div className="relative z-10 mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="mb-20 text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2"
            >
              <span className="text-sm font-semibold text-primary">
                Powerful Features
              </span>
            </motion.div>
            <h2 className="mb-6 text-5xl font-bold tracking-tight text-foreground md:text-6xl">
              Everything You Need to
              <br />
              <GradientText
                gradient="from-primary via-amber-500 to-orange-500"
                animate
              >
                Learn Better
              </GradientText>
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Three powerful features working together to transform your
              learning experience
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
              >
                <FloatingCard className="h-full">
                  <Card className="group relative h-full overflow-hidden border-2 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-5`}
                    />
                    <CardContent className="relative p-8">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 400 }}
                        className={`mb-6 inline-flex items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} p-4 shadow-lg`}
                      >
                        <feature.icon className="h-8 w-8 text-white" />
                      </motion.div>

                      <h3 className="mb-4 text-2xl font-bold">
                        <span className="group-hover:hidden">{feature.title}</span>
                        <GradientText
                          gradient={feature.gradient}
                          className="hidden group-hover:inline"
                        >
                          {feature.title}
                        </GradientText>
                      </h3>

                      <p className="mb-6 text-base leading-relaxed text-muted-foreground">
                        {feature.description}
                      </p>

                      <ul className="space-y-3">
                        {feature.highlights.map((highlight, hIndex) => (
                          <motion.li
                            key={hIndex}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 * hIndex }}
                            className="flex items-center gap-3 text-sm font-medium text-muted-foreground"
                          >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            </div>
                            {highlight}
                          </motion.li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </FloatingCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* I'm Lost Feature Section */}
      <section className="relative overflow-hidden px-4 py-32">
        <DotPattern
          width={25}
          height={25}
          cx={1}
          cy={1}
          cr={1.5}
          className="absolute inset-0 h-full w-full text-primary/5"
        />

        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-amber-500/5 to-background" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-card/80 to-card/40 p-12 backdrop-blur-xl md:p-16"
          >
            <div className="grid items-center gap-16 md:grid-cols-2">
              <div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-5 py-2.5"
                >
                  <HelpCircle className="h-5 w-5 text-primary" />
                  <span className="text-sm font-bold text-primary">
                    Confusion Recovery
                  </span>
                </motion.div>

                <h2 className="mb-6 text-5xl font-bold tracking-tight text-foreground">
                  <RotatingText
                    words={[
                      "Lost in Lecture?",
                      "Feeling Confused?",
                      "Missed Something?",
                      "Need Clarification?",
                    ]}
                    className="block"
                    interval={3000}
                  />
                  <GradientText
                    gradient="from-primary via-amber-500 to-orange-500"
                    animate
                  >
                    We've Got Your Back
                  </GradientText>
                </h2>

                <p className="mb-10 text-lg leading-relaxed text-muted-foreground">
                  One click when you're confused, and ClassPartner instantly
                  recaps the last few minutes. Keep learning without breaking
                  your flow.
                </p>

                <div className="space-y-6">
                  {[
                    {
                      step: "1",
                      title: 'Hit "I\'m Lost" (Cmd+L)',
                      desc: "Press the button when confused",
                    },
                    {
                      step: "2",
                      title: "Get Instant Recap",
                      desc: "AI summarizes the last few minutes",
                    },
                    {
                      step: "3",
                      title: "Keep Learning",
                      desc: "Review tagged moments anytime",
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-4"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-lg font-bold text-white shadow-lg">
                        {item.step}
                      </div>
                      <div>
                        <p className="mb-1 text-lg font-bold text-foreground">
                          {item.title}
                        </p>
                        <p className="text-muted-foreground">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                <div className="relative aspect-square overflow-hidden rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-amber-500/10 p-8 backdrop-blur-sm">
                  <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
                    <div className="relative">
                      <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                      <Brain className="relative h-32 w-32 animate-pulse text-primary" />
                    </div>
                    <div>
                      <p className="mb-3 text-2xl font-bold text-foreground">
                        Never fall behind again
                      </p>
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 px-4 py-2 text-base font-semibold text-primary"
                      >
                        Cmd/Ctrl + L
                      </Badge>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Privacy & Performance Section */}
      <section className="relative px-4 py-32">
        <GridPattern
          width={40}
          height={40}
          className="absolute inset-0 h-full w-full text-primary/5"
        />

        <div className="relative z-10 mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h2 className="mb-6 text-5xl font-bold tracking-tight text-foreground">
              Built for{" "}
              <GradientText
                gradient="from-primary via-amber-500 to-orange-500"
                animate
              >
                <RotatingText
                  words={[
                    "Privacy & Speed",
                    "Security First",
                    "Lightning Performance",
                    "Your Control",
                  ]}
                  interval={3500}
                />
              </GradientText>
            </h2>
            <p className="mx-auto mb-16 max-w-2xl text-xl text-muted-foreground">
              Your data stays on your device. Lightning-fast processing with no
              cloud delays.
            </p>

            <div className="grid gap-8 sm:grid-cols-3">
              {[
                {
                  icon: Lock,
                  title: "Local First",
                  description: "All transcriptions stored on your device",
                  gradient: "from-orange-500 to-amber-500",
                },
                {
                  icon: Shield,
                  title: "Private by Default",
                  description: "No data collection, complete opt-out control",
                  gradient: "from-amber-500 to-yellow-500",
                },
                {
                  icon: Zap,
                  title: "Real-Time Speed",
                  description: "64ms audio latency, instant AI responses",
                  gradient: "from-yellow-500 to-orange-500",
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                >
                  <FloatingCard>
                    <motion.div
                      whileHover={{ y: -5 }}
                      className="group h-full rounded-2xl border-2 border-border bg-card/50 p-8 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
                    >
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 400 }}
                        className={`mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} shadow-lg`}
                      >
                        <item.icon className="h-10 w-10 text-white" />
                      </motion.div>
                      <h3 className="mb-3 text-2xl font-bold text-foreground">
                        {item.title}
                      </h3>
                      <p className="text-base text-muted-foreground">
                        {item.description}
                      </p>
                    </motion.div>
                  </FloatingCard>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden px-4 py-32">
        <DotPattern
          width={20}
          height={20}
          cx={1}
          cy={1}
          cr={1}
          className="absolute inset-0 h-full w-full text-white/10"
        />

        <div className="relative z-10 mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-amber-500 to-orange-500 p-16 text-center shadow-2xl"
          >
            <h2 className="mb-6 text-5xl font-bold text-white md:text-6xl">
              Ready to Learn Smarter?
            </h2>
            <p className="mb-12 text-xl text-white/90">
              Join students who never miss a moment. Download ClassPartner today
              and transform your learning experience.
            </p>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <ShimmerButton className="flex h-16 items-center gap-3 rounded-full border-2 border-white bg-white px-10 text-lg font-bold text-primary shadow-xl transition-all hover:scale-105 hover:shadow-2xl">
                <Download className="h-6 w-6" />
                Download for Mac
              </ShimmerButton>
              <ShimmerButton className="flex h-16 items-center gap-3 rounded-full border-2 border-white bg-white px-10 text-lg font-bold text-primary shadow-xl transition-all hover:scale-105 hover:shadow-2xl">
                <Download className="h-6 w-6" />
                Download for Windows
              </ShimmerButton>
            </div>

            <p className="mt-8 text-sm text-white/80">
              Free forever. No credit card required.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t bg-card/50 px-4 py-16 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-muted-foreground">
            &copy; 2024 ClassPartner. Built with care for students everywhere.
          </p>
        </div>
      </footer>
    </div>
  );
}
