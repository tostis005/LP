-- Extend existing support topics, preserving historical requests and access controls.
ALTER TABLE public.support_requests DROP CONSTRAINT IF EXISTS support_requests_topic_check;
ALTER TABLE public.support_requests ADD CONSTRAINT support_requests_topic_check CHECK(topic IN ('wallet','card','account','rewards','privacy','other','business_info','business_design','business_management','business_marketing','business_technical'));
