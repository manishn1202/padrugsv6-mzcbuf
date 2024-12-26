```
# Input: Prior Authorization for Drugs

# WHY - Vision & Purpose

## 1. Purpose & Users

* Primary Problem Solved: Currently it takes a lot of time for Payers to evaluate if a patient meets all policy criteria for approval of prior authorization (PA) request for any drug/medication. On the providers side also it takes a lot of time to create a prior authorization form for approval of any drug. It is because mostly providers are not aware of the drug policy criteria's for prior auth which at times result in denial of prior auth request. So, we want to solve this problem for both payers and providers. We want to create a co-assistant for Payers (Insurance) to assess/review prior authorization requests as submitted by the provider by looking at drug prior authorization criteria's and then retrieving relevant content from the patient file and provider notes against these criteria's. This will save time for payers to review and make decisions on prior auth request. Separately, we want providers to also be aware of these criteria's while submitting the PA request to ensure they fulfill all requirements of any drug prior auth form.

* Target Users: want to focus both on Payers & Providers

* Value Proposition: Increase in efficiency for payers to review and taking decisions on prior auth requests. For Providers, ensure that prior auth request form completely covers all evidences as required by drug criteria's to reduce prior auth request denials or reduce the re-work on prior auth requests.

# WHAT - Core Requirements

## 2. Functional Requirements

### Core Features

System must:

* Create a web application which can be used by both providers and payers but will have different workflows. Provider should be able to login and submit prior authorization request -- first by connecting to EMR and pulling patient records and provider notes, second by checking if a prescription drug requires prior auth. Similarly, payer should be able to login and review all prior auth requests and take decision on prior auth.

* Follow FHIR and Da Vince protocols in the creating all data schemas for data interoperability.

* In the provider workflow following points are important:
    * For a provider's view, once a provider logs in the landing dashboard should have status of all requests submitted by the provider and their statuses.
    * A provider should be able to click look up feature to look for any patient, drug research and additional information about a drug, submit a prior auth request form (form should include patient demographics, health plan, diagnosis codes, clinical fields etc.), refer to drug authorization form given below. Provider should be able to add any attachments as well for patients.
        * For Drug Prior authorization form (use UHC as example to extract relevant fields). All these fields need to be in the Prior Auth request form:
            * https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/exchanges/General-Prior-Auth-Form-UHC-Exchange.pdf
        * There is also Massachusetts Drug prior authorization form. Use this in addition to the above form for UHC to ensure we capture all data fields:
            * https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/drugs-pharmacy/MA-COMM-Prescription-Prior-Auth-Form.pdf

* On the provider page, there needs to be a feature for a provider to check Patient insurance if its active or not, and get details on its prescription benefits by connecting to payer's API.

* On the providers page, there should also be a feature to know more about that drug. That should connect with leading databases. In the future when you click to that link a new interface will be generated and provide clinical decision support about that drug to the provider. Think like a RAG driven approach where provider can ask any questions about a Drug.

* When a provider logs in, application should securely connect to EMR (take EPIC as example) for pulling patient records (including provider notes) and sending prior authorization information to the payer in the FHIR format.

* Before a provider submits prior auth request, he needs to check if a Drug requires prior authorization or not. If a PA is required then it should be able to submit new prior auth request form. If not required, then a message should come that PA is not required for that Drug. This functionality will be managed through an independent API service (Formulary service) which will pull this information. This information will be stored in a database, from where the service will pick this info. Formulary list is different for each of the health plans. For Commercial plan, list of formulary drug is: https://www.uhcprovider.com/content/dam/provider/docs/public/resources/pharmacy/Commerical-PDL-Eff-Jan-2024.pdf

* Formulary service will have a separate service where we will pull the pdf of formulary drugs as per the health plan. This will be stored in a database keeping FHIR standards. It will be used when a provider will select a drug to check if a PA is required or not then this service will be called. If it is "Yes", then a new workflow will be called to submit a new prior auth request. If a PA is not required then it will just display that PA is not required. This service will be managed independently so that if there are any changes in the formulary drug lists then it will track changes and update the formulary drug database accordingly.

* For submitting a PA request, there will be an option to choose the payer where the prior auth requests needs to be sent. As MVP, we will consider UHC. But number of payers will increase in future.

In the payer workflow:

* For a payer's view, display all prior auth requests submitted to the payer with their status in the core landing dashboard.

* Payer should be able to review patient records and providers notes against each of the drug policy criteria for both initial prior authorization or reauthorization requests and see a matching score along with the sources from where it pulled that info in patient records.

* Use Generative AI model (example - Claude 3.5) in performing this matching. Do not hard code for Claude 3.5. We should be able to change models in future. Model should be generic any LLM (to begin with we will use Claude models).

* There needs to be a feature to also fine tune the LLM when we start getting feedback from payer review. So, a model will learn from the prior auth requests submitted and from payer review and any changes done by the payer.

* There should also be a feedback loop where payer can provide us feedback on how we were able to do a matching. Feedback can be both qualitative and quantitative feedback so that we can improvise the solution.

Additional Requirements:

* To pull policy criterias, create an independent service which pulls all policy criterias for a particular drug from the policy criteria database.

* This policy criterias database is created by another independent service which crawls payer's website for downloading prior auth drug policies, then extracts all criterias from these policies using Gen AI model. It also look at changes in these policies and accordingly update the policy criteria database every night. This would ensure that the database has most updated policy criterias all the time. These policies are present on payer website in the pdf formats. A sample policy document can be found here:
    * For Drug policy structures, refer to a sample policy drug:
        * https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/drugs-pharmacy/commercial/a-g/PA-Med-Nec-Abilify-Mycite.pdf

* Policy database is a separate service where we need to pull all policy documents and extract criteria's and keep it in database using FHIR standards. These policies will be extracted based on a Drug ID when a matching is required between policy criteria's and patient info. This service will be managed independently so that if there are any changes in the policies then it will track changes and update the policy criteria database accordingly.

* Creating database schemas and tables for storing all information using FHIR resources. Keep it very generic as in future we will expand from one payer to multiple payers, and look at all FHIR resources required for prior authorization. If a resource is not available in FHIR then create custom schemas and database.

* Provide automated alerts for PA requests submission, status changes, approval and denial notifications.

* Include in-app guidance and tooltips for key features.

* Maintain automated data backup system with user data export capabilities.

### User Capabilities

Users (Payers and Providers) must be able to:

* Securely authenticate using email/password.

* Have different workflows, landing pages, and views for providers and payers (depending on drug prior authorization). You can refer few competitor portals such as Covermymeds, Surescripts for understanding provider and payer workflows:
    * https://www.covermymeds.health/
    * https://surescripts.com/what-we-do/electronic-prior-authorization

* Securely connect to EMR to pull patient records.

* Payer should be able to reach out to provider to ask any questions for a prior auth request. If the evidence submitted by the provider is not sufficient then payer should ask for more evidence to take decision on prior auth request.

* Payer workflow should also have a feature to escalate to medical doctor on payer's side to review prior auth request.

* View consolidated dashboard of their prior auth requests.

* Receive notifications when there is a new prior auth request or any status changes.

* Export their data in CSV format.

* Access email support for technical assistance.

# HOW - Planning & Implementation

## 3. Technical Foundation

### Required Stack Components

* All development of this web application should use native AWS services (unless any service is not available for anything specific functionality). The tech architecture diagram should be very detailed and should highlight which service to be used for each of the steps.

* Frontend: use React.js with CSS (add other linked services)

* Backend: RESTful API architecture with secure data storage and backup systems (Python based)

* Integrations: with EMRs of Healthcare systems, Payer portals, other web - Drug databases

* Infrastructure: use all AWS services. Cloud-hosted with automated scaling

### System Requirements

* Performance: Dashboard load time under 3 seconds, real-time updates

* Security: End-to-end encryption, secure authentication

* Compliance: HIPAA compliance to be followed for everything

* Scalability: Support for multiple users, daily processing

* Reliability: 99.9% uptime, daily data synchronization, automated backups

* Testing: Comprehensive unit testing, security testing, and automated UI testing required

## 4. User Experience

### Primary User Flows

1. Provider
    * Entry: User logs in, landing page is a dashboard with status on all current prior auth requests, their status, old prior auth requests which need to be re-submitted for re-authorizations.
    * For submitting a new prior auth request, it should be able to search for a patient record, then select a patient, pull all data from the EMR.
    * First thing a provider needs to check is if a Prior authorization for a Drug is required or not. This needs to be checked by looking at the formulary list of Drugs (through a separate service of Formulary list of drugs). We will have separate API service to check that. That API service will retrieve the information from the database which we have created after extracting this information from payers website. This service will run daily to check if there is any changes in the formulary list of drugs.
    * User clicks on 'New request' for prior authorization. It should select if its a 'Initial' prior authorization request or 'Re-authorization' request. Is it urgent or not? All fields which are present in the prior auth request form (the link shared above) should be present in this form.
    * There should be a place holder to make edits in the form.
    * Provider should be able to upload any attachments.
    * Provider should click on "automatically refill from EMR" or "manual fill" which will fill the prior auth form. For each section there needs to be edit functionality. This automatically fill the form will be done by an independent service which will look at the form fields and pull relevant data from the patient file and EMR. It will help in saving time for provider to fill the PA form.
    * Provider clicks on submitting a form and it is being sent to the payer. Behind it should also create a complete submission as a JSON file. Payer should be notified about a prior auth form being sent for approval.
    * Provider can always save draft of the form to be completed later.

2. Payer
    * Entry: User logs in, review all prior auth requests in a dashboard with multiple statuses.
    * There needs to be also a view for the admin user who can review any prior auth requests submitted to the payer.
    * Steps: user selects a patient, can see all its basic data which are required in a prior auth form. Then click on 'Review' button. A new page opens up which has pre filled information with each of the policy criteria's (column 1) for a drug from the backend database, and patient data (column2) which is relevant for each of the criteria's. An independent matching service would have done this matching using Gen AI. Third column will be telling if patient data "Met", "Do not met", "Partially met" also creates a confidence score in the 3rd column about a match. It could be based on cosine similarity score.
    * User should be able to make edits.
    * In that page user can do approve, deny or ask for more information.
    * If user approves prior auth, then a notification is sent to the provider who submitted prior auth request with an approval prior auth form describing all details.
    * If a user asks for more information or clarifications, then again the form is sent back to the provider. Provider then add more details and re-submits the prior auth form.
    * If a user declines, then that notification is sent back to provider with a denial form illustrating the reason. Front office payer rep can also escalate any prior auth review to their supervisor if they are not sure.
    * User should be able to make edits in all of these forms.

## 5. Business Requirements

### Access Control

* User Types: both payers and providers separately
* Authentication: Email/password + optional biometric
* Authorization: Users access only their linked data
* HIPAA aligned

### Business Rules

As stated earlier in the document

## 6. Implementation Priorities

### High Priority (Must Have)

As stated earlier in the document

### Medium Priority (Should Have)

### Lower Priority (Nice to Have)
```