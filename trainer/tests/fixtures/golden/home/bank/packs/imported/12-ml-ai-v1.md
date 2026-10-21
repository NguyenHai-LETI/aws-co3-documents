---
pack: saa-12-ml-ai-v1
title: 12 · Machine Learning & AI · V1
exam: SAA-C03
origin: imported
source: practice-exams/12-ml-ai-exam.md
created: 2026-10-16
---

# 12 · Machine Learning & AI · V1

> Imported from `practice-exams/12-ml-ai-exam.md` + `12-ml-ai-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 12-v1-01
- domain: performance
- task: 3.2
- topic: ml
- services: Rekognition
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q1

An application must detect objects, faces, and inappropriate content in user-uploaded images and videos. Which service?

- A. Amazon Rekognition
- B. Amazon Polly
- C. Amazon Textract
- D. Amazon Comprehend

**Answer:** A

**Explanation:** Image/video object/face/moderation = Rekognition.

---

## Q 12-v1-02
- domain: performance
- task: 3.2
- topic: ml
- services: Comprehend
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q2

A company wants sentiment analysis and key-phrase/entity extraction from customer reviews. Which service?

- A. Amazon Transcribe
- B. Amazon Lex
- C. Amazon Comprehend
- D. Amazon Translate

**Answer:** C

**Explanation:** Sentiment + entity/key-phrase from text = Comprehend.

---

## Q 12-v1-03
- domain: performance
- task: 3.2
- topic: ml
- services: Transcribe
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q3

Which service converts speech in audio files into text (e.g., for call-center transcripts)?

- A. Amazon Polly
- B. Amazon Transcribe
- C. Amazon Comprehend
- D. Amazon Kendra

**Answer:** B

**Explanation:** Speech-to-text = Transcribe.

---

## Q 12-v1-04
- domain: performance
- task: 3.2
- topic: ml
- services: Polly
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q4

Which service converts text into lifelike speech (text-to-speech)?

- A. Amazon Translate
- B. Amazon Transcribe
- C. Amazon Lex
- D. Amazon Polly

**Answer:** D

**Explanation:** Text-to-speech = Polly.

---

## Q 12-v1-05
- domain: performance
- task: 3.2
- topic: ml
- services: Translate
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q5

Which service provides neural machine translation between languages?

- A. Amazon Rekognition
- B. Amazon Comprehend
- C. Amazon Polly
- D. Amazon Translate

**Answer:** D

**Explanation:** Neural translation = Translate.

---

## Q 12-v1-06
- domain: performance
- task: 3.2
- topic: ml
- services: Lex
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q6

A team must build a conversational chatbot with automatic speech recognition and natural language understanding (same tech as Alexa). Which service?

- A. Amazon Lex
- B. Amazon Polly
- C. Amazon Comprehend
- D. Amazon Personalize

**Answer:** A

**Explanation:** Chatbot ASR+NLU (Alexa tech) = Lex.

---

## Q 12-v1-07
- domain: performance
- task: 3.2
- topic: ml
- services: SageMaker
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q7

A data science team needs to build, train, tune, and deploy custom ML models with notebooks and managed infrastructure. Which service?

- A. Amazon Rekognition
- B. Amazon Comprehend
- C. Amazon SageMaker
- D. AWS Glue

**Answer:** C

**Explanation:** Build/train/deploy custom models = SageMaker.

---

## Q 12-v1-08
- domain: performance
- task: 3.5
- topic: ml
- services: Personalize
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q8

An e-commerce site wants real-time personalized product recommendations without building ML from scratch. Which service?

- A. Amazon Personalize
- B. Amazon Comprehend
- C. Amazon Kendra
- D. Amazon Forecast

**Answer:** A

**Explanation:** Real-time recommendations = Personalize.

---

## Q 12-v1-09
- domain: performance
- task: 3.2
- topic: ml
- services: Forecast
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q9

A retailer needs accurate time-series demand forecasting using ML. Which service?

- A. Amazon Rekognition
- B. Amazon Personalize
- C. Amazon Timestream
- D. Amazon Forecast

**Answer:** D

**Explanation:** Time-series demand forecasting = Forecast.

---

## Q 12-v1-10
- domain: performance
- task: 3.3
- topic: ml
- services: Textract
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q10

A company must extract text, forms, and tables from scanned documents (e.g., invoices, PDFs). Which service?

- A. Amazon Textract
- B. Amazon Comprehend
- C. Amazon Rekognition
- D. Amazon Transcribe

**Answer:** A

**Explanation:** Extract text/forms/tables from docs = Textract.

---

## Q 12-v1-11
- domain: performance
- task: 3.3
- topic: ml
- services: Kendra
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q11

An enterprise needs an intelligent, ML-powered internal search engine over documents with natural-language queries. Which service?

- A. Amazon OpenSearch
- B. Amazon Athena
- C. Amazon Kendra
- D. Amazon Comprehend

**Answer:** C

**Explanation:** ML-powered NL enterprise search = Kendra.

---

## Q 12-v1-12
- domain: performance
- task: 3.2
- topic: ml
- services: Bedrock
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q12

A company wants to add generative AI (foundation models) to an app via a managed API without managing infrastructure. Which service?

- A. Amazon Rekognition
- B. Amazon Bedrock
- C. Amazon Lex
- D. Amazon SageMaker Ground Truth

**Answer:** B

**Explanation:** Generative AI foundation models via API = Bedrock.

---

## Q 12-v1-13
- domain: performance
- task: 3.2
- topic: ml
- services: Comprehend
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q13

A healthcare app must extract medical entities (medications, conditions) from clinical text. Which service?

- A. Amazon Polly
- B. Amazon Comprehend Medical
- C. Amazon Transcribe Medical only
- D. Amazon Translate

**Answer:** B

**Explanation:** Medical entity extraction from text = Comprehend Medical.

---

## Q 12-v1-14
- domain: performance
- task: 3.2
- topic: ml
- services: Fraud Detector
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q14

A bank wants to detect potentially fraudulent online transactions using ML with minimal data science effort. Which service?

- A. Amazon Macie
- B. AWS WAF
- C. Amazon Fraud Detector
- D. Amazon GuardDuty

**Answer:** C

**Explanation:** ML fraud detection, low effort = Amazon Fraud Detector.

---

## Q 12-v1-15
- domain: performance
- task: 3.2
- topic: ml
- services: SageMaker
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q15

Which service would you use to label/annotate training datasets with human reviewers?

- A. Amazon Rekognition
- B. Amazon Mechanical Turk only
- C. Amazon Comprehend
- D. Amazon SageMaker Ground Truth

**Answer:** D

**Explanation:** Human-labeled training data = SageMaker Ground Truth.

---

## Q 12-v1-16
- domain: performance
- task: 3.5
- topic: ml
- services: Transcribe
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q16

A live streaming platform must automatically caption audio to text in real time. Which service?

- A. Amazon Kendra
- B. Amazon Polly
- C. Amazon Translate
- D. Amazon Transcribe (streaming)

**Answer:** D

**Explanation:** Real-time captions = Transcribe streaming.

---

## Q 12-v1-17
- domain: performance
- task: 3.2
- topic: ml
- services: Polly
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q17

Which AI service pairing would convert a foreign-language article to English speech? (Pick the correct chain)

- A. Rekognition → Lex
- B. Translate → Polly
- C. Transcribe → Comprehend
- D. Textract → Translate

**Answer:** B

**Explanation:** Foreign text -> English speech = Translate then Polly.

---

## Q 12-v1-18
- domain: performance
- task: 3.2
- topic: ml
- services: SageMaker
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q18

Which is the BEST choice when a fully custom model and full control of training are required?

- A. Amazon Personalize
- B. Amazon SageMaker
- C. Amazon Comprehend
- D. Amazon Rekognition

**Answer:** B

**Explanation:** Full custom model/control = SageMaker.

---

## Q 12-v1-19
- domain: performance
- task: 3.2
- topic: ml
- services: Rekognition, Comprehend
- difficulty: medium
- time: 75
- source: practice-exams/12-ml-ai-exam.md#Q19

Which two are managed AI services that require NO ML expertise to use via API? (Choose TWO)

- A. Amazon Rekognition
- B. Amazon Comprehend
- C. Amazon Redshift
- D. Amazon SageMaker (training your own model)
- E. Amazon EMR

**Answer:** A, B

**Explanation:** Pre-trained API AI services = Rekognition and Comprehend.

---

## Q 12-v1-20
- domain: performance
- task: 3.2
- topic: ml
- services: Transcribe, Comprehend
- difficulty: easy
- time: 45
- source: practice-exams/12-ml-ai-exam.md#Q20

A contact center wants to transcribe calls, then analyze sentiment and redact PII. Which combination is BEST?

- A. Amazon Rekognition + Amazon Kendra
- B. Amazon Polly + Amazon Translate
- C. Amazon Transcribe + Amazon Comprehend
- D. Amazon Lex + Amazon Forecast

**Answer:** C

**Explanation:** Transcribe calls + analyze/redact = Transcribe + Comprehend.
