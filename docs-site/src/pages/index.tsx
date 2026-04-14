import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './index.module.css';

function HeroSection() {
  return (
    <header className={styles.heroBanner}>
      <div className="container">
        <h1 className={styles.heroTitle}>Master AI Engineering</h1>
        <p className={styles.heroSubtitle}>
          The most comprehensive hands-on course for building production AI systems
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/intro">
            Start Learning
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="#curriculum">
            View Curriculum
          </Link>
        </div>
      </div>
      <div className={styles.heroGlow} />
    </header>
  );
}

function StatsBar() {
  return (
    <div className={styles.statsBar}>
      <div className="container">
        <div className="row">
          <div className="col col--3">6 Chapters</div>
          <div className="col col--3">50+ Concepts</div>
          <div className="col col--3">AI Tutor</div>
          <div className="col col--3">Free to Start</div>
        </div>
      </div>
    </div>
  );
}

const chapters = [
  { title: 'Intro to LLMs', desc: 'Foundations of large language models.', link: '/chapter-1/intro', icon: '🧠' },
  { title: 'Prompt Engineering', desc: 'Master the art of prompting.', link: '/chapter-2/intro', icon: '📝' },
  { title: 'RAG Systems', desc: 'Retrieval Augmented Generation.', link: '/chapter-3/intro', icon: '📚' },
  { title: 'Fine-Tuning', desc: 'Optimizing models for specific tasks.', link: '/chapter-4/intro', icon: '⚙️' },
  { title: 'AI Agents', desc: 'Building autonomous AI systems.', link: '/chapter-5/intro', icon: '🤖' },
  { title: 'Evaluation', desc: 'Measuring AI performance.', link: '/chapter-6/intro', icon: '📊' },
];

function CurriculumSection() {
  return (
    <section id="curriculum" className={styles.section}>
      <div className="container">
        <h2 className={styles.sectionTitle}>Curriculum</h2>
        <div className="row">
          {chapters.map((ch, idx) => (
            <div key={idx} className="col col--4 margin-bottom--lg">
              <div className="card shadow--md">
                <div className="card__header">
                  <span style={{ fontSize: '2rem' }}>{ch.icon}</span>
                  <h3>{ch.title}</h3>
                </div>
                <div className="card__body">
                  <p>{ch.desc}</p>
                </div>
                <div className="card__footer">
                  <Link className="button button--outline button--primary" to={ch.link}>
                    Read Chapter
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AITutorSection() {
  return (
    <section className={styles.sectionAlt}>
      <div className="container text--center">
        <h2>Ask Anything, Anytime</h2>
        <p>Our AI tutor powered by Groq answers your questions instantly</p>
        <button 
          className="button button--primary button--lg"
          onClick={() => {
            const btn = document.getElementById('chatbot-toggle');
            if (btn) btn.click();
          }}>
          Try AI Tutor
        </button>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Professional AI Engineering Curriculum">
      <HeroSection />
      <StatsBar />
      <CurriculumSection />
      <AITutorSection />
      <main>
      </main>
    </Layout>
  );
}
