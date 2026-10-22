---
pack: saa-12-ml-ai-v2
title: 12 · Machine Learning / AI · V2
exam: SAA-C03
origin: imported
source: practice-exams/12-ml-ai-exam-v2.md
created: 2026-10-16
---

# 12 · Machine Learning / AI · V2

> Imported from `practice-exams/12-ml-ai-exam-v2.md` + `12-ml-ai-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 12-v2-01
- domain: performance
- task: 3.2
- topic: ml
- services: Rekognition
- difficulty: medium
- time: 50
- source: practice-exams/12-ml-ai-exam-v2.md#Q1

An app must detect objects, faces, and inappropriate content in images and video. Which service?

- A. Amazon Textract
- B. Amazon Rekognition
- C. Amazon Polly
- D. Amazon Comprehend

**Answer:** B

**Explanation:** Image/video object/face/content detection = Amazon Rekognition.

---

## Q 12-v2-02
- domain: performance
- task: 3.3
- topic: ml
- services: Textract
- difficulty: medium
- time: 50
- source: practice-exams/12-ml-ai-exam-v2.md#Q2

A company must extract text, key-value pairs, and tables from scanned documents/forms. Which service?

- A. Amazon Rekognition
- B. Amazon Transcribe
- C. Amazon Translate
- D. Amazon Textract

**Answer:** D

**Explanation:** Extract text/forms/tables from documents = Amazon Textract.

---

## Q 12-v2-03
- domain: performance
- task: 3.2
- topic: ml
- services: Transcribe
- difficulty: medium
- time: 50
- source: practice-exams/12-ml-ai-exam-v2.md#Q3

An application must convert speech in audio files to text (transcription). Which service?

- A. Amazon Lex
- B. Amazon Comprehend
- C. Amazon Transcribe
- D. Amazon Polly

**Answer:** C

**Explanation:** Speech to text = Amazon Transcribe.

---

## Q 12-v2-04
- domain: performance
- task: 3.2
- topic: ml
- services: Polly
- difficulty: medium
- time: 50
- source: practice-exams/12-ml-ai-exam-v2.md#Q4

An app must convert text into lifelike speech (text-to-speech). Which service?

- A. Amazon Transcribe
- B. Amazon Translate
- C. Amazon Polly
- D. Amazon Lex

**Answer:** C

**Explanation:** Text to lifelike speech = Amazon Polly.

---

## Q 12-v2-05
- domain: performance
- task: 3.5
- topic: ml
- services: Translate
- tags: streaming-ingestion
- difficulty: medium
- time: 50
- source: practice-exams/12-ml-ai-exam-v2.md#Q5

A company must translate text between languages in real time. Which service?

- A. Amazon Textract
- B. Amazon Translate
- C. Amazon Polly
- D. Amazon Comprehend

**Answer:** B

**Explanation:** Language translation = Amazon Translate.

---

## Q 12-v2-06
- domain: performance
- task: 3.2
- topic: ml
- services: Comprehend
- difficulty: medium
- time: 50
- enriched: 2026-10-22
- source: practice-exams/12-ml-ai-exam-v2.md#Q6

A company must analyze customer feedback for sentiment and key phrases (NLP). Which service?

- A. Amazon Translate
- B. Amazon Personalize
- C. Amazon Rekognition
- D. Amazon Comprehend

**Answer:** D

**Explanation:** Amazon Comprehend is the managed NLP service that detects sentiment, key phrases, entities and language in text such as customer feedback.
- Amazon Translate: converts text between languages; no sentiment analysis.
- Amazon Personalize: product recommendations from interaction data.
- Amazon Rekognition: analyzes images and video, not text.
> 🇻🇳 Phân tích cảm xúc, cụm từ khoá trong văn bản → Amazon Comprehend.

---

## Q 12-v2-07
- domain: performance
- task: 3.2
- topic: ml
- services: Lex
- difficulty: medium
- time: 50
- source: practice-exams/12-ml-ai-exam-v2.md#Q7

A team must build a conversational chatbot with automatic speech recognition and natural language understanding. Which service?

- A. Amazon Polly
- B. Amazon Translate
- C. Amazon Lex
- D. Amazon Comprehend

**Answer:** C

**Explanation:** Conversational chatbot (ASR+NLU) = Amazon Lex.

---

## Q 12-v2-08
- domain: performance
- task: 3.3
- topic: ml
- services: Kendra
- difficulty: medium
- time: 50
- status: retired
- source: practice-exams/12-ml-ai-exam-v2.md#Q8

A company wants an intelligent enterprise search service over internal documents using natural language queries. Which service?

- A. OpenSearch only
- B. Athena
- C. Amazon Comprehend
- D. Amazon Kendra

**Answer:** D

**Explanation:** Enterprise NL document search = Amazon Kendra.

---

## Q 12-v2-09
- domain: performance
- task: 3.5
- topic: ml
- services: Personalize
- tags: streaming-ingestion
- difficulty: medium
- time: 50
- enriched: 2026-10-22
- source: practice-exams/12-ml-ai-exam-v2.md#Q9

An e-commerce site wants real-time personalized product recommendations. Which service?

- A. Amazon Personalize
- B. Amazon Rekognition
- C. Build a custom personalized-recommendation model on SageMaker AI
- D. Amazon Lex

**Answer:** A

**Explanation:** Amazon Personalize is the managed recommendation service: it trains on interaction data and returns real-time personalized recommendations through an API.
- Amazon Rekognition: image and video analysis.
- Custom model on SageMaker AI: possible, but you must build, train and operate it yourself.
- Amazon Lex: conversational chatbots.
> 🇻🇳 Gợi ý sản phẩm cá nhân hoá real-time → Amazon Personalize.

---

## Q 12-v2-10
- domain: performance
- task: 3.2
- topic: ml
- services: SageMaker
- difficulty: medium
- time: 50
- enriched: 2026-10-22
- source: practice-exams/12-ml-ai-exam-v2.md#Q10

A company must build, train, and deploy custom ML models end-to-end in a managed environment. Which service?

- A. Amazon Lex
- B. Amazon SageMaker AI
- C. Amazon Rekognition
- D. Amazon Comprehend

**Answer:** B

**Explanation:** Amazon SageMaker AI (formerly Amazon SageMaker) is the managed environment to build, train and deploy custom ML models end to end.
- Amazon Lex: builds chatbots.
- Amazon Rekognition: pre-trained image and video analysis.
- Amazon Comprehend: pre-trained NLP.
> 🇻🇳 Xây, huấn luyện, triển khai model riêng trọn vòng đời → Amazon SageMaker AI.

---

## Q 12-v2-11
- domain: performance
- task: 3.2
- topic: ml
- services: Forecast
- difficulty: hard
- time: 90
- status: retired
- enriched: 2026-10-21
- source: practice-exams/12-ml-ai-exam-v2.md#Q11

A company must forecast future product demand from historical time-series data without building models manually. Which service?

- A. Amazon SageMaker AI (formerly SageMaker), which requires manually designing and training a custom forecasting model
- B. Amazon QuickSight, which can chart historical trends but needs an analyst to configure each forecast manually
- C. Amazon Kinesis Data Analytics, which processes streaming data in real time but does not generate demand forecasts
- D. Amazon Forecast, which builds and trains the forecasting model automatically from the historical data

**Answer:** D

**Explanation:** Amazon Forecast is the purpose-built managed service that trains and selects a time-series forecasting model automatically, so no data-science team has to design one by hand.
- SageMaker AI (formerly SageMaker): a general ML platform where you still have to build, train, and tune the forecasting model yourself.
- QuickSight: visualizes trends and offers a basic forecast widget, but each chart's forecast must be configured manually, it is not a dedicated demand-forecasting pipeline.
- Kinesis Data Analytics: processes streaming data in real time; it does not train or produce forward-looking demand predictions.
> 🇻🇳 Cần dự báo tự động, không tự xây model → Amazon Forecast; các lựa chọn khác đều cần tự thiết lập mô hình/báo cáo.

---

## Q 12-v2-12
- domain: performance
- task: 3.2
- topic: ml
- services: Fraud Detector
- difficulty: hard
- time: 65
- status: retired
- source: practice-exams/12-ml-ai-exam-v2.md#Q12

A company must detect potentially fraudulent online transactions using ML with minimal ML expertise. Which service?

- A. Amazon Fraud Detector
- B. Amazon Comprehend
- C. Amazon Macie
- D. Amazon GuardDuty

**Answer:** A

**Explanation:** ML fraud detection, low expertise = Amazon Fraud Detector.

---

## Q 12-v2-13
- domain: performance
- task: 3.2
- topic: ml
- services: Bedrock
- difficulty: hard
- time: 70
- enriched: 2026-10-22
- source: practice-exams/12-ml-ai-exam-v2.md#Q13

A team needs to build generative AI applications using foundation models via a managed API without managing infrastructure. Which service?

- A. Amazon Bedrock
- B. Amazon Rekognition
- C. Amazon Comprehend
- D. Amazon SageMaker Ground Truth

**Answer:** A

**Explanation:** Amazon Bedrock gives access to foundation models from Amazon and other providers through one managed API, so teams build generative AI applications without managing infrastructure.
- Amazon Rekognition: pre-trained image and video analysis, not generative AI.
- Amazon Comprehend: pre-trained NLP analysis such as sentiment.
- SageMaker Ground Truth (part of Amazon SageMaker AI): labels training data with human workers.
> 🇻🇳 Ứng dụng generative AI dùng foundation model qua API → Amazon Bedrock.

---

## Q 12-v2-14
- domain: cost
- task: 4.2
- topic: ml
- services: SageMaker
- tags: serverless-cost
- difficulty: hard
- time: 70
- enriched: 2026-10-22
- source: practice-exams/12-ml-ai-exam-v2.md#Q14

An Amazon SageMaker AI inference endpoint has spiky traffic and must scale to zero when idle to save cost while handling bursts. Which option?

- A. Multi-model endpoint always-on
- B. Always-on real-time endpoint
- C. SageMaker AI Serverless Inference
- D. Batch transform only

**Answer:** C

**Explanation:** SageMaker AI Serverless Inference provisions compute only while requests arrive, scales to zero when idle and scales out automatically for bursts, so you pay per use.
- Multi-model endpoint always-on: hosts many models on one endpoint but keeps instances running when idle.
- Always-on real-time endpoint: billed for instances around the clock even with no traffic.
- Batch transform only: offline jobs with no low-latency responses to live requests.
> 🇻🇳 Traffic thất thường, cần về 0 khi rảnh → SageMaker AI Serverless Inference.

---

## Q 12-v2-15
- domain: performance
- task: 3.2
- topic: ml
- services: Comprehend
- difficulty: hard
- time: 65
- source: practice-exams/12-ml-ai-exam-v2.md#Q15

A medical documents pipeline must extract entities like medications and diagnoses from clinical text. Which service is purpose-built?

- A. Amazon Translate
- B. Amazon Comprehend Medical
- C. Amazon Rekognition
- D. Amazon Textract

**Answer:** B

**Explanation:** Clinical entity extraction = Amazon Comprehend Medical.
