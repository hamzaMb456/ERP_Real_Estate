# Graph Report - ERP_Real_Estate  (2026-10-29)

## Corpus Check
- 716 files · ~503,710 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4391 nodes · 14151 edges · 272 communities (193 shown, 79 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 344 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Appearance Settings UI
- Calendar Component Tests
- Storage S3 API Routes
- Theme & Fonts Setup
- AppSync Dispatch & Events
- Maps & Incomplete Records
- Public Listing Pages
- Requests & Visits Pages
- Booking & Public UI Tests
- AppSync Appointment Handlers
- Request Rules & Validation
- Public Listing Pages
- Appointment Dialog & Mutations
- Leaflet Maps
- Units Filtering Logic
- Public Home Hero & Filters
- Auth Provider & Session
- Appointment Details & Editor
- Theme Icons & Palette
- Ownership Rules
- Unit Filtering
- Lease-Contact Components
- Calendar Feed Hook
- Lease Draft Editing
- Appointment Decisions Logic
- Misc Utilities
- Lease & Calendar Operations
- Maps & Incomplete Records
- Charts & Recharts
- Common Areas & CRUD Lists
- Lease Rules Engine
- Unit Filtering
- Appointment List UI
- Public Buy/Rent Pages
- Empty Concepts
- Appointment Sheet UI
- Contacts & Appointments Rules
- App Sidebar & Navigation
- Maps & Incomplete Records
- Storage S3 API Routes
- Common Areas & CRUD Lists
- Unit Dialog Form
- Auth Claims & Resolver Context
- UI Primitives & Icons
- Contact Form
- Leases & Properties Lists
- Calendar Toolbar & Dates
- Calendar Toolbar & Dates
- Playwright Specs
- Appointment Sheet UI
- Test Harness & Vitest
- Lease Draft Editing
- GraphQL Query Modules
- Places Domain: Properties & Units
- Visitor Requests Backend
- Calendar Page
- Placeholder Pages
- ERP Auth Pages & Config
- Public Listing Pages
- Visit Booking Forms
- Appointment Labels
- ERP Auth Pages & Config
- Visit Booking Forms
- Mailer & SMTP
- Favorites & Charts
- Misc Utilities
- Mail Events & Change Records
- Listing Details UI
- App Header & Breadcrumb
- Common Areas & CRUD Lists
- Theme Icons & Palette
- App Layout & Motion
- UI Primitives & Icons
- Load Test Script
- Metrics Kinesis Dashboard
- Tecnocasa Prototype Scripts
- Backend Concepts
- Two-Org Isolation Demo
- Theme & Fonts Setup
- Calendar Page
- Infra Dependencies & CDK
- Ops Scripts & Health Checks
- CloudFormation Deploy
- Logs & Metrics Scripts
- Backup Tooling
- Dynamo & Persistence Tooling
- Backup Integration Tests
- AWS SDK Patch Tooling
- Notifications Concepts
- ERP Auth Pages & Config
- Floci Concepts
- Ownership Concepts
- Dev & Testing Dependencies
- Calendar Notifications DB
- Storage Buckets & Listings Schema
- Requests & Visit Settings Ops
- Leases Concepts
- Docker Compose Config
- Branches Concepts
- Tsconfig Concepts
- Auth Concepts
- Name Concepts
- Auth Concepts
- Security Concepts
- Foundation DB Schema
- Environment Concepts
- Permissions Concepts
- Deploy Concepts
- Scripts Concepts
- Steps Concepts
- Cache Concepts
- Build Concepts
- Access Concepts
- Interval Concepts
- Branches Concepts
- Calendar & UI Libraries
- Contacts Concepts
- Files Concepts
- Labels Concepts
- Listings Concepts
- Misc Community
- File Concepts
- Command Concepts
- Name Concepts
- Name Concepts
- Local Concepts
- Storage Concepts
- Node Concepts
- Name Concepts
- Lint Concepts
- Type Concepts
- Leases DB Schema
- Property & Unit Forms
- Functions Dependencies
- UI Components Config
- Appearance Concepts
- TypeScript Config
- CI Steps
- CI Lint Config
- CI Workflow
- PFE Metrics & Deploy Notes
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Utilities
- Misc Community
- Misc Community
- Misc Community
- Agent Instructions & Graph Policy
- Misc Utilities
- Golden Concepts
- Decision Concepts
- Stitch Concepts
- Class Concepts
- Ownership Concepts
- Client Concepts
- Front Concepts
- Invoice Concepts
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Backend Concepts
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Agency Concepts
- Listings Concepts
- Misc Community
- Daily Concepts
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Standard Concepts
- Delete Concepts
- Biens Concepts
- Rent Concepts
- Site Concepts
- Under Concepts
- Misc Community
- Misc Community
- Misc Community
- Common Concepts
- Login Concepts
- Common Concepts
- Property Concepts
- Misc Community
- Layout Concepts
- Lease Concepts
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Empty Concepts
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Misc Community
- Password Reset Form
- Auth Actions API
- Misc Utilities
- Misc Utilities
- Playwright E2E Tests
- Misc Utilities
- ERP Page Catalog
- Misc Utilities
- Misc Utilities
- Misc Utilities
- Spec Decisions Matrix

## God Nodes (most connected - your core abstractions)
1. `useT()` - 269 edges
2. `Button` - 182 edges
3. `react` - 148 edges
4. `next` - 94 edges
5. `useGraphql` - 88 edges
6. `Card (component family)` - 82 edges
7. `graphql (AppSync gateway call)` - 82 edges
8. `CardContent()` - 75 edges
9. `fail(code) helper` - 74 edges
10. `toUserMessage()` - 71 edges

## Surprising Connections (you probably didn't know these)
- `Batch 4 calendar/notifications integration test` --semantically_similar_to--> `calendar_feed view (appointments + all-day lease events start/end/registration deadline)`  [INFERRED] [semantically similar]
  infra/amplify-data/lambda/api/calendar-ops.int.test.ts → db/migrations/0004_calendar_notifications.sql
- `Daily Lambda (scheduler cron 05:00 UTC)` --semantically_similar_to--> `generate_daily_notifications() (daily job: lease flags + tomorrow's appointments -> notifications)`  [INFERRED] [semantically similar]
  infra/amplify-data/amplify/backend.ts → db/migrations/0004_calendar_notifications.sql
- `Floci local AWS backend (Cognito/JWKS, AppSync, Secrets Manager)` --shares_data_with--> `resolveSecretEnv() Secrets Manager with warm-container cache`  [INFERRED]
  docker-compose.yml → functions/_lib/secrets.ts
- `Per-IP Rate Limiter (5 / 10 min)` --semantically_similar_to--> `Rate-Limit / CAPTCHA Gap on Public AppSync Endpoint`  [INFERRED] [semantically similar]
  prototypes/tecnocasa-features/02-request-hardening.html → graphify-out/memory/query_20261028_115613_ea403e90_tecnocasa_features__what_is_already_implemented_an.md
- `Dev Data Seed Script` --semantically_similar_to--> `Local Postgres Docker Harness`  [INFERRED] [semantically similar]
  infra/amplify-data/scripts/seed.mjs → scripts/db-local.sh

## Import Cycles
- 5-file cycle: `web/src/i18n/messages/fr/index.ts -> web/src/i18n/messages/fr/notifications.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/fr/index.ts`
- 5-file cycle: `web/src/i18n/messages/ar/dashboard.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/ar/index.ts -> web/src/i18n/messages/ar/dashboard.ts`
- 5-file cycle: `web/src/i18n/messages/en/index.ts -> web/src/i18n/messages/en/notifications.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/en/index.ts`
- 5-file cycle: `web/src/i18n/messages/fr/index.ts -> web/src/i18n/messages/fr/requests.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/fr/index.ts`
- 5-file cycle: `web/src/i18n/messages/ar/calendar.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/ar/index.ts -> web/src/i18n/messages/ar/calendar.ts`
- 5-file cycle: `web/src/i18n/messages/ar/index.ts -> web/src/i18n/messages/ar/notifications.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/ar/index.ts`
- 5-file cycle: `web/src/i18n/messages/ar/index.ts -> web/src/i18n/messages/ar/units.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/ar/index.ts`
- 5-file cycle: `web/src/i18n/messages/ar/index.ts -> web/src/i18n/messages/ar/requests.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/ar/index.ts`
- 5-file cycle: `web/src/i18n/messages/ar/index.ts -> web/src/i18n/messages/ar/site.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/ar/index.ts`
- 5-file cycle: `web/src/i18n/messages/ar/index.ts -> web/src/i18n/messages/ar/properties.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/ar/index.ts`
- 5-file cycle: `web/src/i18n/messages/fr/dashboard.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/fr/index.ts -> web/src/i18n/messages/fr/dashboard.ts`
- 5-file cycle: `web/src/i18n/messages/fr/index.ts -> web/src/i18n/messages/fr/properties.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/fr/index.ts`
- 5-file cycle: `web/src/i18n/messages/en/calendar.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/en/index.ts -> web/src/i18n/messages/en/calendar.ts`
- 5-file cycle: `web/src/i18n/messages/en/dashboard.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/en/index.ts -> web/src/i18n/messages/en/dashboard.ts`
- 5-file cycle: `web/src/i18n/messages/en/index.ts -> web/src/i18n/messages/en/properties.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/en/index.ts`
- 5-file cycle: `web/src/i18n/messages/en/index.ts -> web/src/i18n/messages/en/units.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/en/index.ts`
- 5-file cycle: `web/src/i18n/messages/en/index.ts -> web/src/i18n/messages/en/requests.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/en/index.ts`
- 5-file cycle: `web/src/i18n/messages/en/index.ts -> web/src/i18n/messages/en/site.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/en/index.ts`
- 5-file cycle: `web/src/i18n/messages/fr/index.ts -> web/src/i18n/messages/fr/units.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/fr/index.ts`
- 5-file cycle: `web/src/i18n/messages/fr/calendar.ts -> web/src/i18n/plural.ts -> web/src/i18n/store.ts -> web/src/i18n/messages/index.ts -> web/src/i18n/messages/fr/index.ts -> web/src/i18n/messages/fr/calendar.ts`

## Hyperedges (group relationships)
- **Client-account auth flow: public account pages → /api/auth action dispatcher → Cognito (role=client set server-side on confirm)** — web_src_app_site_compte_connexion_page_signinpage, web_src_app_site_compte_inscription_page_signuppage, web_src_app_site_compte_mot_de_passe_oublie_page_siteforgotpasswordpage, web_src_app_api_auth_route_post, web_src_lib_server_cognito_cognito, web_src_app_api_auth_route_test [EXTRACTED 0.85]
- **Floci observability/metrics pipeline** — infra_amplify_data_scripts_deploy_timed_mjs_deploytimedmetrics, infra_amplify_data_scripts_dry_health_mjs_dryhealth, infra_amplify_data_metrics_dashboard, infra_amplify_data_metrics_2026_10_27_deploy_report, infra_amplify_data_metrics_2026_10_27_inventory_report, infra_amplify_data_metrics_2026_10_27_load_report, infra_amplify_data_metrics_2026_10_27_logs_report [EXTRACTED 0.85]
- **Client actions land in the ERP: accounts, SECURITY DEFINER functions, one-agency org** — front_office_design_client_accounts, front_office_design_security_definer_functions, front_office_design_one_agency_org, front_office_design_public_site [EXTRACTED 0.85]
- **Public vitrine and visitor funnel (listings, publication, requests, WhatsApp)** — docs_superpowers_handoffs_2026_10_22_front_office_slice_1_public_site, docs_superpowers_handoffs_2026_10_22_front_office_slice_1_listing_publication_card, docs_superpowers_handoffs_2026_10_23_visitor_requests_visitor_requests, docs_superpowers_notes_2026_10_28_tecnocasa_features_whatsapp_button [EXTRACTED 0.85]
- **Admin approval workflows (user registrations and ITV requests)** — infra_amplify_data_metrics_pfe_img_p69_im43_admin_dashboard_ui, infra_amplify_data_metrics_pfe_img_p70_im44_user_approvals_ui, infra_amplify_data_metrics_pfe_img_p70_im45_itv_approvals_ui [EXTRACTED 0.90]
- **RAG Knowledge Base Feeding Groq AI Assistant with Source Citations** — infra_amplify_data_metrics_pfe_img_p75_im53_rag_knowledge_base, infra_amplify_data_metrics_pfe_img_p75_im53_s3_sync_bulk_import, infra_amplify_data_metrics_pfe_img_p75_im54_ai_assistant_groq, infra_amplify_data_metrics_pfe_img_p75_im54_agentic_db_querying [EXTRACTED 0.90]
- **Animated icon system (data + factory + GSAP rendering)** — web_src_components_icons_icon_data_icon_data, web_src_components_icons_animated_icon_animatedicon, web_src_components_icons_animated_icon_makeicon, web_src_components_icons_index_iconexports, web_src_components_icons_theme_glyph_themeglyph [EXTRACTED 0.90]
- **Arabic (RTL) localization bundle set** — web_src_i18n_config_localeconfig, web_src_i18n_messages_ar_appearance_appearancemessages, web_src_i18n_messages_ar_calendar_calendarmessages, web_src_i18n_messages_ar_common_commonmessages, web_src_i18n_messages_ar_contacts_contactsmessages, web_src_i18n_messages_ar_dashboard_dashboardmessages [EXTRACTED 0.90]
- **Cached never-throw public listing reads (use cache + safely + listingsWhere + publicQuery)** — web_src_lib_site_public_api_publicquery, web_src_lib_site_listings_queries_safely, web_src_lib_site_listings_queries_listingswhere, web_src_lib_site_listings_queries_topubliclisting, web_src_lib_site_listings_queries_getlatestlistings, web_src_lib_site_listings_queries_searchlistings, web_src_lib_site_listings_queries_getlisting, web_src_lib_site_listings_queries_getlistingsbyids, web_src_lib_site_listings_queries_countpublished, web_src_lib_site_listings_queries_getpublishedcities [EXTRACTED 0.90]
- **Calendar/appointment domain (feed rows, labels, Tunis timezone, staff conflicts)** — web_src_lib_appointment_types_feedrow, web_src_lib_appointment_types_notificationkind, web_src_lib_appointments_appointments, web_src_lib_appointments_test, web_src_lib_calendar_test [EXTRACTED 0.90]
- **Calendar feed data pipeline (GraphQL rows normalized for grid and lease tab)** — web_src_components_calendar_use_calendar_feed_usecalendarfeed, web_src_components_calendar_use_calendar_feed_usefeedrows, web_src_components_calendar_use_calendar_feed_normalizefeedrow, web_src_lib_use_graphql_usegraphql, web_src_lib_calendar_calendarrangequery, web_src_components_calendar_lease_calendar_tab_leasecalendartab [EXTRACTED 0.90]
- **CloudWatch Observability Toolkit (logs + pushed latency metrics)** — infra_amplify_data_scripts_log_dump_logdump, infra_amplify_data_scripts_log_since_logsince, infra_amplify_data_scripts_logs_window_logwindow, infra_amplify_data_scripts_logs_metrics_logsmetrics, infra_amplify_data_scripts_load_test_loadtest [EXTRACTED 0.90]
- **Common areas tab composition** — web_src_components_common_areas_common_areas_tab_commonareastab, web_src_components_common_areas_common_areas_list_commonareaslist, web_src_components_common_areas_shares_table_sharestable, web_src_components_confirm_dialog_confirmdialog [EXTRACTED 0.90]
- **cva-based variant system (class-variance-authority)** — web_src_components_ui_button_variants_buttonvariants, web_src_components_ui_badge_badge, web_src_components_ui_button_group_buttongroup, web_src_components_ui_empty_empty, web_src_components_ui_field_field, web_src_components_ui_input_group_inputgroup [EXTRACTED 0.90]
- **eam-prod AKS Infrastructure (Terraform state + Azure portal + Helm dashboard evidence)** — infra_amplify_data_metrics_pfe_img_p79_im57_azure_portal_eam_prod_aks, infra_amplify_data_metrics_pfe_img_p80_im58_terraform_workspace_aks_phase0, infra_amplify_data_metrics_pfe_img_p81_im59_helm_dashboard_eam_releases [EXTRACTED 0.90]
- **File/photo upload pipeline** — web_src_components_files_file_drop_filedrop, web_src_components_files_file_uploader_fileuploader, web_src_components_files_pending_photos_pendingphotos, web_src_components_files_pending_photos_uploadpendingphotos, web_src_components_files_photo_gallery_photogallery, web_src_components_files_document_list_documentlist [EXTRACTED 0.90]
- **Floci integration test harness** — infra_amplify_data_lambda_domain_test_env_usedevtables, infra_amplify_data_lambda_domain_requests_int_test_visitorrequestsflow, infra_amplify_data_scripts_backup_int_test_restoreinttests [EXTRACTED 0.90]
- **Listing publishing flow: staff publish in ERP → trigger rules → public views → public pages** — front_office_design_listings_publishing, slice1_migration_0005_listings, front_office_design_public_listings_view, slice1_public_data_layer, slice1_public_pages [EXTRACTED 0.90]
- **AWS observability & measurable-metric capture (scripts → raw files → dashboard/CV)** — inventory_aws_resources, load_test_appsync, logs_audit, deploy_timing, infra_amplify_data_metrics_dashboard_kinesis, cv_notes_metrics [EXTRACTED 0.90]
- **Dictionary-driven labels and messages via i18n store** — web_src_lib_errors_tousermessage, web_src_lib_files_validatefile, web_src_lib_format_formattnd, web_src_lib_gaps_gaplabel, web_src_lib_calendar_leaseeventkindlabels [EXTRACTED 0.90]
- **Browser-only Leaflet map stack (dynamic import, shared SVG pin)** — web_src_components_map_index_mapexports, web_src_components_map_location_field_locationfield, web_src_components_map_location_picker_inner_locationpickerinner, web_src_components_map_listings_map_inner_listingsmapinner, web_src_components_map_properties_map_inner_propertiesmapinner, web_src_components_map_pin_pinicon [EXTRACTED 0.90]
- **Leases lifecycle project (functions, thresholds, calendar, notifications)** — docs_superpowers_handoffs_2026_10_15_leases_plan_a_plan_a_delivery, docs_superpowers_plans_2026_10_15_leases_core_lease_functions, docs_superpowers_plans_2026_10_15_leases_core_lease_rule_thresholds, docs_superpowers_plans_2026_10_16_leases_calendar_notifications_migration_0004, docs_superpowers_plans_2026_10_16_leases_calendar_notifications_generate_daily_notifications, docs_superpowers_handoffs_2026_10_16_leases_plan_b_plan_b_delivery [EXTRACTED 0.90]
- **Floci/LocalStack CI-CD pattern (LocalStack container + Amplify deploy + web container across workflows)** — github_workflows_ci_ci_pipeline, github_workflows_ci_e2e_tests_job, github_workflows_ci_infra_tests_job, github_workflows_deploy_deploy_dev_job, github_workflows_deploy_deploy_prod_job [EXTRACTED 0.90]
- **Multi-tenant isolation framework (two walls + organization_id everywhere)** — docs_phase_2_architecture_01_architecture_vision_two_walls_isolation, docs_phase_2_architecture_01_architecture_vision_shared_database_rls, docs_phase_2_architecture_02_architecture_diagrams_organization_id_isolation, docs_phase_2_database_01_foundation_schema_multi_tenant_rule [EXTRACTED 0.90]
- **MVP authorization model - roles, privilege grid, departments, isolation** — organisation_acces_separation, organisation_acces_one_account, organisation_acces_privilege_grid, organisation_acces_five_roles, organisation_acces_departments, organisation_acces_server_side [EXTRACTED 0.90]
- **Palette extension workflow: add palette, translate names, verify with tests** — web_src_theme_readme_add_palette_workflow, web_src_theme_readme_seed_structure, web_src_theme_readme_i18n_palette_translations, web_src_theme_readme_generate_test [EXTRACTED 0.90]
- **Planning approval lifecycle and technician notification** — infra_amplify_data_metrics_pfe_img_p62_im32_planning_workflow, infra_amplify_data_metrics_pfe_img_p62_im32_planning_states, infra_amplify_data_metrics_pfe_img_p62_im32_technician_notification, infra_amplify_data_metrics_pfe_img_p63_im33_planning_management_ui, infra_amplify_data_metrics_pfe_img_p63_im34_planning_calendar_ui [EXTRACTED 0.90]
- **Playwright E2E ERP Journey Suite (shared helpers, French UI)** — web_e2e_helpers_e2ehelpers, web_e2e_calendar_spec_calendarflow, web_e2e_core_records_spec_corerecordsflow, web_e2e_front_office_spec_frontofficeflow, web_e2e_leases_spec_leaselifecycleflow, web_e2e_i18n_spec_i18nflow [EXTRACTED 0.90]
- **Public catalog data layer: home and listing pages share the cached, never-throwing listings queries** — site_home_page_HomePage, listing_page_ListingPage, web_src_lib_site_listings_queries_getlisting, web_src_lib_site_listings_queries_searchlistings, web_src_lib_site_listings_queries_getlatestlistings, web_src_lib_site_listings_queries_countpublished, web_src_lib_site_listings_queries_getpublishedcities, web_src_lib_site_similar_picksimilar [EXTRACTED 0.90]
- **Public website listing generation (units → public views)** — db_migrations_0005_listings_check_listing_publishable, db_migrations_0005_listings_public_listings, db_migrations_0005_listings_public_listing_photos, 0006_units_on_website_units_public_listing, 0007_unit_details_unit_detail_columns [EXTRACTED 0.90]
- **Role-Based Dashboard Suite (Admin, Chef Technique, Technicien)** — infra_amplify_data_metrics_pfe_img_p27_im16_admin_dashboard, infra_amplify_data_metrics_pfe_img_p28_im17_chef_technique_dashboard, infra_amplify_data_metrics_pfe_img_p28_im18_technician_dashboard [EXTRACTED 0.90]
- **Sales in the MVP - decisions, seller models and golden workflow** — phase0_decision_sales_included, cahier_general_d008, cahier_general_d009, golden_workflow_sale [EXTRACTED 0.90]
- **Server-side S3 storage endpoints: shared session/role auth, ownership scoping, registry bookkeeping, write freeze** — storage_upload_route_POST, storage_presign_route_POST, storage_delete_route_POST, web_src_lib_server_auth_requiresession, web_src_lib_server_auth_requirewriter, web_src_lib_server_file_ownership_resolvestoragekeybucket, web_src_lib_server_storage_registry_registerstoragefile, web_src_lib_server_storage_registry_forgetstoragefile, web_src_lib_server_s3_client_s3, web_src_lib_storage_buckets_isstoragekey, web_src_lib_write_freeze_writesfrozen [EXTRACTED 0.90]
- **shadcn-style Radix UI primitive library** — web_src_components_ui_scroll_area_scrollarea, web_src_components_ui_select_select, web_src_components_ui_separator_separator, web_src_components_ui_sheet_sheet, web_src_components_ui_sidebar_sidebar, web_src_components_ui_skeleton_skeleton, web_src_components_ui_sonner_sonnertoaster, web_src_components_ui_table_table, web_src_components_ui_tabs_tabs, web_src_components_ui_textarea_textarea, web_src_components_ui_toggle_group_togglegroup, web_src_components_ui_toggle_toggle, web_src_components_ui_tooltip_tooltip [EXTRACTED 0.90]
- **No-flash first-paint mechanism: saved theme mirrored to localStorage and re-injected inline** — web_src_theme_readme_localstorage_active_theme, web_src_theme_readme_theme_script_layout_tsx, web_src_theme_readme_script_ts, web_src_theme_readme_is_default_selection [EXTRACTED 0.90]
- **Upload-then-link storage flow with rollback (UploadDeps port, property and lease buckets)** — web_src_lib_upload_uploadandlink, web_src_lib_upload_uploaddeps, web_src_lib_storage_storagedeps, web_src_lib_storage_leasestoragedeps, web_src_lib_storage_uploadtobucket, web_src_lib_storage_deletestoredfile [EXTRACTED 0.90]
- **Public visitor request flow (website listing -> throttle-checked submit -> staff notification)** — db_migrations_0007_unit_details_public_listings, db_migrations_0008_visitor_requests_check_visitor_request, db_migrations_0008_visitor_requests_submit_rental_request, db_migrations_0008_visitor_requests_submit_visit_request, db_migrations_0008_visitor_requests_phone_digits, db_migrations_0008_visitor_requests_notify_staff_of_request, db_migrations_0004_calendar_notifications_notifications, db_migrations_0009_client_accounts_require_client_on_request [EXTRACTED 0.90]
- **Visitor rental/visit request flow (validate early, DB functions stay authority, error codes worded in dialog)** — web_src_lib_site_request_form_validatecontact, web_src_lib_site_request_form_validaterental, web_src_lib_site_request_form_validatevisit, web_src_lib_site_request_form_requesterrorcode, web_src_lib_site_request_actions_submitrentalrequestaction, web_src_lib_site_request_actions_submitvisitrequestaction, web_src_lib_site_public_api_publicquery, web_src_lib_site_public_api_clientquery [EXTRACTED 0.90]
- **Appointment detail sheet flow (load, badges, status actions, participant resend)** — web_src_components_calendar_appointment_sheet_appointmentsheet, web_src_components_calendar_appointment_sheet_sheetbody, web_src_components_calendar_appointment_sheet_content_appointmentsheetcontent, web_src_components_calendar_appointment_participants_list_appointmentparticipantslist, web_src_components_calendar_appointment_details_appointment_query, web_src_components_calendar_appointment_mutations_setappointmentstatusmutation, web_src_components_calendar_appointment_mutations_resendparticipantmutation [EXTRACTED 0.95]
- **Appointment load-and-edit flow (editor → query → dialog → minimal-diff mutations)** — web_src_components_calendar_appointment_editor_appointmenteditor, web_src_components_calendar_appointment_details_appointment_query, web_src_components_calendar_appointment_details_detailstoinitial, web_src_components_calendar_appointment_dialog_appointmentdialog, web_src_components_calendar_appointment_mutations_updateappointmentmutation [EXTRACTED 0.95]
- **Cavecrew subagent system (compressed-output delegation)** — claude_skills_cavecrew_skill, claude_agents_cavecrew_investigator_agent, claude_agents_cavecrew_builder_agent, claude_agents_cavecrew_reviewer_agent, claude_skills_ultracave_skill [EXTRACTED 0.95]
- **EAM Azure Deployment Pipeline (Terraform → Azure → Helm → environments → ngrok → public URL)** — infra_amplify_data_metrics_pfe_img_p78_im56_terraform_iac, infra_amplify_data_metrics_pfe_img_p78_im56_azure_resources, infra_amplify_data_metrics_pfe_img_p78_im56_helm_chart, infra_amplify_data_metrics_pfe_img_p78_im56_eam_staging, infra_amplify_data_metrics_pfe_img_p78_im56_eam_prod, infra_amplify_data_metrics_pfe_img_p78_im56_ngrok_tunnel, infra_amplify_data_metrics_pfe_img_p78_im56_public_https_demo_url [EXTRACTED 0.95]
- **Forgotten-password flow shared by ERP sign-in and public site** — web_src_i18n_messages_fr_shell, web_src_lib_auth_password_reset, web_src_lib_auth_use_password_reset, web_src_lib_auth_session [EXTRACTED 0.95]
- **Cookie-driven i18n locale pipeline (store -> provider -> dictionaries, plural via Intl)** — web_src_i18n_store_store, web_src_i18n_provider_i18nprovider, web_src_i18n_plural_plural, web_src_i18n_messages_index_messages [EXTRACTED 0.95]
- **Lease draft form composition** — web_src_components_leases_lease_form_leaseform, web_src_components_leases_lease_units_field_leaseunitsfield, web_src_components_leases_lease_parties_field_leasepartiesfield [EXTRACTED 0.95]
- **Lease lifecycle actions (draft/activate/renew/end)** — web_src_components_leases_lease_actions_leaseactions, web_src_components_leases_lease_dialogs_activatedialog, web_src_components_leases_lease_dialogs_renewdialog, web_src_components_leases_lease_dialogs_enddialog, web_src_components_leases_lease_action_dialog_leaseactiondialog, web_src_components_leases_lease_details_leasedetails [EXTRACTED 0.95]
- **Lease lifecycle SQL functions under test** — db_migrations_0003_leases_activate_lease, db_migrations_0003_leases_renew_lease, db_migrations_0003_leases_end_lease, db_migrations_0003_leases_change_rent, db_migrations_0003_leases_expire_overdue_leases, db_migrations_0003_leases_assert_no_lease_overlap, db_migrations_0003_leases_sync_unit_status [EXTRACTED 0.95]
- **Lease lifecycle state machine (draft -> active -> ended/expired, guarded updates, overlap locks)** — db_migrations_0003_leases_leases, db_migrations_0003_leases_lease_session_org, db_migrations_0003_leases_guard_lease_update, db_migrations_0003_leases_assert_no_lease_overlap, db_migrations_0003_leases_activate_lease, db_migrations_0003_leases_renew_lease, db_migrations_0003_leases_end_lease, db_migrations_0003_leases_change_rent, db_migrations_0003_leases_expire_overdue_leases, db_migrations_0003_leases_sync_unit_status [EXTRACTED 0.95]
- **Minimal-diff save strategy (only changed columns, only added/removed participants, one request, untouched participants not re-invited)** — web_src_components_calendar_appointment_mutations_changedfields, web_src_components_calendar_appointment_mutations_diffparticipants, web_src_components_calendar_appointment_mutations_updateappointmentmutation [EXTRACTED 0.95]
- **Unit ownership management flow (add co-owner, transfer, delete)** — web_src_components_ownership_unit_owners_tab_unitownerstab, web_src_components_ownership_add_coowner_dialog_addcoownerdialog, web_src_components_ownership_transfer_dialog_transferdialog, web_src_components_ownership_owners_editor_ownerseditor, web_src_components_ownership_contact_picker_contactpicker, web_src_components_ownership_use_contact_options_usecontactoptions [EXTRACTED 0.95]
- **Core properties/units data consumers (list, map, units, dashboard)** — biens_list_BiensPage, biens_carte_PropertiesMapPage, unites_list_UnitsPage, erp_dashboard_DashboardPage [EXTRACTED 0.95]
- **Guided question-flow form pattern** — web_src_components_forms_question_flow_questionflow, web_src_components_domain_property_form_propertyform, web_src_components_domain_unit_dialog_unitform, web_src_components_forms_question_flow_choicechips, web_src_components_forms_question_flow_multichips, web_src_components_field_help_fieldlabelwithhelp [EXTRACTED 0.95]
- **Radix primitive wrapper pattern (data-slot shadcn components)** — web_src_components_ui_dialog_dialog, web_src_components_ui_dropdown_menu_dropdownmenu, web_src_components_ui_popover_popover, web_src_components_ui_checkbox_checkbox, web_src_components_ui_radio_group_radiogroup, web_src_components_ui_progress_progress, web_src_components_ui_label_label, web_src_components_ui_collapsible_collapsible, web_src_components_ui_avatar_avatar [EXTRACTED 0.95]
- **Single AppSync resolver dispatches all operations through a typed Op registry with role gating** — infra_amplify_data_lambda_api_index_handler, infra_amplify_data_lambda_api_dispatch_dispatch, infra_amplify_data_lambda_api_registry_op, api_ops_index_OPS [EXTRACTED 0.95]
- **Stock reservation lifecycle flow (reserve / error / release / expiry / fulfill + audit)** — infra_amplify_data_metrics_pfe_img_p67_im40_try_reserve, infra_amplify_data_metrics_pfe_img_p67_im40_insufficient_stock_error, infra_amplify_data_metrics_pfe_img_p67_im40_create_deficit_alert, infra_amplify_data_metrics_pfe_img_p67_im40_release_all, infra_amplify_data_metrics_pfe_img_p67_im40_release_expired, infra_amplify_data_metrics_pfe_img_p67_im40_celery_beat, infra_amplify_data_metrics_pfe_img_p67_im40_fulfill_reservation, infra_amplify_data_metrics_pfe_img_p67_im40_required_piece, infra_amplify_data_metrics_pfe_img_p67_im40_mouvement_stock, infra_amplify_data_metrics_pfe_img_p67_im40_stock_quantity, infra_amplify_data_metrics_pfe_img_p67_im40_consumed_piece [EXTRACTED 0.95]
- **Theme customization UI (palette pick, per-role colors, live preview, saved palettes)** — web_src_components_appearance_appearance_settings_appearancesettings, web_src_components_appearance_color_field_colorfield, web_src_components_appearance_palette_swatch_paletteswatch, web_src_components_appearance_preview_panel_previewpanel, web_src_components_appearance_saved_palettes_savedpalettes [EXTRACTED 0.95]
- **Theme pipeline: palette seed → generated tokens → applied/persisted** — web_src_theme_readme_palettes_ts, web_src_theme_readme_generate_ts, web_src_theme_readme_color_ts, web_src_theme_readme_provider_tsx, web_src_theme_readme_storage_ts, web_src_theme_readme_globals_css_defaults [EXTRACTED 0.95]
- **Visitor request submission flow (portal → staff)** — infra_amplify_data_lambda_domain_requests_submit, infra_amplify_data_lambda_domain_requests_submitrentalrequest, infra_amplify_data_lambda_domain_requests_submitvisitrequest, infra_amplify_data_lambda_domain_request_rules_isthrottled, infra_amplify_data_lambda_domain_requests_notifystaff, infra_amplify_data_lambda_domain_requests_updatevisitrequest [EXTRACTED 0.95]
- **Four predictive signals fused via Dempster-Shafer into a unified health score** — infra_amplify_data_metrics_pfe_img_p53_im28_pinn_rul, infra_amplify_data_metrics_pfe_img_p53_im28_cox_survival, infra_amplify_data_metrics_pfe_img_p53_im28_mahalanobis_hi, infra_amplify_data_metrics_pfe_img_p53_im28_cusum_kalman, infra_amplify_data_metrics_pfe_img_p53_im28_dst_fusion, infra_amplify_data_metrics_pfe_img_p53_im28_unified_health_score [EXTRACTED 1.00]
- **Unit page composition (breadcrumb, header, booking card, details, similar)** — web_src_components_site_listing_page_content_listingpagecontent, web_src_components_site_listing_header_listingbreadcrumb, web_src_components_site_listing_header_listingheader, web_src_components_site_listing_similar_listingsimilar [EXTRACTED 1.00]
- **RAG document-answer flow (upload, vector store, retrieval, LLM answer)** — infra_amplify_data_metrics_pfe_img_p59_im31_rag_architecture, infra_amplify_data_metrics_pfe_img_p59_im31_rag_service, infra_amplify_data_metrics_pfe_img_p59_im31_postgres_pgvector, infra_amplify_data_metrics_pfe_img_p59_im31_minio, infra_amplify_data_metrics_pfe_img_p59_im31_groq_llm [EXTRACTED 1.00]
- **Search page streaming composition (shell + Suspense results)** — web_src_components_site_search_page_searchpage, web_src_components_site_search_page_searchcontent, web_src_components_site_search_skeleton_searchskeleton, web_src_components_site_search_filters_searchfilterspanel, web_src_components_site_search_results_searchresults, web_src_components_site_search_results_searchheader [EXTRACTED 1.00]
- **Sort select joined to the GET filter form via form attribute** — web_src_components_site_search_results_sortselect, web_src_components_site_search_filters_search_form_id, web_src_components_site_search_filters_searchfilterspanel, web_src_components_site_search_filters_nativeselect [EXTRACTED 1.00]
- **Tecnocasa Feature Prototype Suite (hub + 5 standalone demos)** — prototypes_tecnocasa_features_index_prototype_hub, prototypes_tecnocasa_features_01_whatsapp_contact_whatsapp_click_to_chat, prototypes_tecnocasa_features_02_request_hardening_antibot_shields, prototypes_tecnocasa_features_03_similar_listings_similar_rule, prototypes_tecnocasa_features_04_price_drop_badge_price_history, prototypes_tecnocasa_features_05_print_pdf_printable_sheet [EXTRACTED 1.00]
- **Pre-paint theme hydration: mirrorActive writes ACTIVE_KEY, THEME_SCRIPT injects before paint, AppearanceSync takes over** — web_src_theme_store_mirroractive, web_src_theme_storage_active_key, web_src_theme_script_theme_script, web_src_theme_provider_appearancesync [EXTRACTED 1.00]
- **Theme generation pipeline: selection -> seed -> OKLCH maths -> token CSS** — web_src_theme_palettes_seedof, web_src_theme_generate_generatetheme, web_src_theme_color_hextooklch, web_src_theme_color_ensurecontrast, web_src_theme_provider_applytodocument [EXTRACTED 1.00]
- **Visit Request Anti-Abuse Decision Flow** — prototypes_tecnocasa_features_02_request_hardening_submit_handler, prototypes_tecnocasa_features_02_request_hardening_honeypot_field, prototypes_tecnocasa_features_02_request_hardening_turnstile_captcha, prototypes_tecnocasa_features_02_request_hardening_ip_rate_limiter, prototypes_tecnocasa_features_02_request_hardening_org_cap, prototypes_tecnocasa_features_02_request_hardening_phone_quota, prototypes_tecnocasa_features_02_request_hardening_refuse [EXTRACTED 1.00]
- **Predictive maintenance: telemetry → ML predictions/DST health score → readiness alerts → purchase draft** — infra_amplify_data_metrics_pfe_img_p40_im26_ml_prediction_flow, infra_amplify_data_metrics_pfe_img_p42_im27_machine, infra_amplify_data_metrics_pfe_img_p42_im27_utilisateur [INFERRED 0.70]
- **Public unit page composition (booking card, gallery, detail sections)** — web_src_components_site_listing_booking_card_listingbookingcard, web_src_components_site_listing_gallery_listinggallery, web_src_components_site_listing_details_listingdescription, web_src_components_site_listing_details_listingfeatures, web_src_components_site_listing_details_listinglocation, web_src_components_site_listing_details_listingconditions [INFERRED 0.70]
- **Co-ownership share and transfer domain logic (100% cap, 1000 tantièmes)** — web_src_lib_ownership_validatenewowners, web_src_lib_ownership_plantransfer, web_src_lib_ownership_rowstoreopen, web_src_lib_shares_suggestshares [INFERRED 0.75]
- **Role-Based Dashboards (Chef Technique vs Technicien vs Admin)** — infra_amplify_data_metrics_pfe_img_p71_im46_technical_manager_dashboard, infra_amplify_data_metrics_pfe_img_p71_im47_technician_dashboard, infra_amplify_data_metrics_pfe_img_p74_im52_ml_models_admin_page [INFERRED 0.75]
- **Staff request processing flow (rental + visit requests)** — web_src_components_requests_request_board_requestboard, web_src_components_requests_request_card_requestcard, web_src_components_requests_request_mutations_confirmvisit, web_src_components_requests_request_mutations_closevisit, web_src_components_requests_use_request_action_userequestaction, web_src_components_requests_use_request_action_requesttone [INFERRED 0.75]
- **Visit fee flow: payment method setting, fee display on public listing and booking, fee handling in ERP visit requests** — en_visitSettings_VisitPayment, web_src_i18n_messages_en_requests_requestpipeline, web_src_i18n_messages_en_site_publicsitemessages [INFERRED 0.75]
- **App-wide GSAP scroll motion system (reveal, wheel easing, progress bar)** — web_src_components_motion_primitives_scrollstagger, web_src_components_motion_smooth_scroll_smoothscroll, web_src_components_motion_primitives_scrollprogress, web_src_components_motion_primitives_pulse, web_src_components_motion_primitives_skeletonlist [INFERRED 0.80]
- **Predictive Maintenance Workflow on CMS1-L1 Fleet (plan -> execute -> ML alert -> parts order)** — infra_amplify_data_metrics_pfe_img_p23_im10_plan_execution_form, infra_amplify_data_metrics_pfe_img_p24_im11_machine_ml_intelligence_tab, infra_amplify_data_metrics_pfe_img_p25_im13_alert_triage_center, infra_amplify_data_metrics_pfe_img_p26_im15_machine_ml_metrics_parts_forecast, infra_amplify_data_metrics_pfe_img_p28_im18_technician_dashboard [INFERRED 0.80]
- **Lease lifecycle domain: statuses, registration deadline, renewal/grace, constraint errors and notifications** — web_src_i18n_messages_ar_leases_lease_status_lifecycle, web_src_i18n_messages_ar_leases_lease_registration_deadline, web_src_i18n_messages_ar_leases_lease_renewal, web_src_i18n_messages_ar_errors_server_constraint_messages, web_src_i18n_messages_ar_notifications_notification_kinds [INFERRED 0.80]
- **Email-on-table-change pipeline (streams → decisions → SMTP)** — infra_amplify_data_amplify_backend_mailerlambda, functions_lib_event_rowchangeevent, functions_lib_appointment_decisions_decideparticipantaction, functions_lib_appointment_decisions_decideappointmentaction, functions_lib_mail_templates_notificationmail, functions_lib_mailer_createmailer, functions_lib_smtp_env_resolvemailer, functions_lib_secrets_resolvesecretenv [INFERRED 0.80]
- **Maintenance intervention lifecycle from request to ADMIN closure** — infra_amplify_data_metrics_pfe_img_p40_im26_intervention_workflow, infra_amplify_data_metrics_pfe_img_p42_im27_ordretravail, infra_amplify_data_metrics_pfe_img_p42_im27_ordreintervention, infra_amplify_data_metrics_pfe_img_p42_im27_statut_enum [INFERRED 0.80]
- **ML Predictions → Fleet Dashboard → Alerts → Work Orders Flow** — infra_amplify_data_metrics_pfe_img_p74_im52_seven_ml_model_registry, infra_amplify_data_metrics_pfe_img_p72_im48_dst_fused_health_score, infra_amplify_data_metrics_pfe_img_p73_im49_ai_fleet_dashboard, infra_amplify_data_metrics_pfe_img_p73_im50_parts_shortage_critical_alerts, infra_amplify_data_metrics_pfe_img_p71_im46_completed_work_orders_table [INFERRED 0.80]
- **Public-site visit funnel: visitor books on unit page → visit request → fee method → confirmed visit enters calendar** — web_src_i18n_messages_ar_site_public_site, web_src_i18n_messages_ar_requests_visit_request_workflow, web_src_i18n_messages_ar_visit_settings_visit_fee_methods, web_src_i18n_messages_en_calendar_calendar_dictionary [INFERRED 0.80]
- **Public-site visitor experience (config, favorites, account gates)** — web_src_lib_site_config_siteconfig, web_src_lib_site_favorites_usefavorites, web_src_lib_site_account_safesitenext, web_src_lib_site_account_validateaccount [INFERRED 0.80]
- **Tunisia-Themed Site Branding Imagery** — web_public_site_hero_emeraldimmobilierheroillustration, web_public_art_photos_content_tunis_skyline_panorama, web_public_art_photos_header_afdb_tunis_buildingphoto, web_public_art_photos_sidebar_bvmt_tunis_stockexchangephoto [INFERRED 0.80]
- **Unit website publication flow (blockers + visibility)** — web_src_components_units_unit_card_unitcard, web_src_components_website_website_card_websitecard, web_src_components_website_website_card_setunitvisibilitymutation [INFERRED 0.80]
- **Work order lifecycle from state machine to monitoring and completion UI** — infra_amplify_data_metrics_pfe_img_p65_im37_ot_status_lifecycle, infra_amplify_data_metrics_pfe_img_p66_im38_ot_tracking_ui, infra_amplify_data_metrics_pfe_img_p66_im39_ot_completion_wizard [INFERRED 0.80]
- **URL-driven calendar navigation (?vue= & ?date= state)** — web_src_components_calendar_calendar_url_viewfromparam, web_src_components_calendar_calendar_url_paramfromview, web_src_components_calendar_calendar_url_datefromparam, web_src_components_calendar_calendar_url_visiblerange, web_src_components_calendar_calendar_view_calendarview, web_src_components_calendar_calendar_view_lazy_calendarviewlazy, web_src_components_calendar_calendar_toolbar_calendartoolbar [INFERRED 0.85]
- **CI/CD security & quality pipeline (SAST, SCA, secrets, container scan, DAST, SonarQube quality gate)** — infra_amplify_data_metrics_pfe_img_p29_im20_cicd_pipeline_graph, infra_amplify_data_metrics_pfe_img_p30_im21_gitleaks_job, infra_amplify_data_metrics_pfe_img_p32_im22_sonarqube_overview, infra_amplify_data_metrics_pfe_img_p33_im23_trivy_grafana, infra_amplify_data_metrics_pfe_img_p34_im24_zap_grafana [INFERRED 0.85]
- **Daily jobs anchored to Tunis time (grace expiry, notifications, ownership snapshot, listing resync)** — infra_amplify_data_lambda_domain_dates_todaytunis, infra_amplify_data_lambda_domain_leases_expireoverdueleases, infra_amplify_data_lambda_domain_notifications_generatedailynotifications, infra_amplify_data_lambda_domain_ownerships_refreshcurrentowners, infra_amplify_data_lambda_domain_public_listings_resyncallpubliclistings [INFERRED 0.85]
- **Floci AWS-Emulator Support Tooling** — infra_amplify_data_scripts_patch_patch, infra_amplify_data_scripts_patch_test_patchtest, infra_amplify_data_scripts_reconcile_indexes_reconcileindexes, infra_amplify_data_scripts_persistence_check_persistencecheck, infra_amplify_data_scripts_seed_seed [INFERRED 0.85]
- **Graphify Workflow Discipline (query-first, tagged edges, incremental refresh)** — agents_graph_first_query_policy, agents_edge_provenance_tags, agents_incremental_graph_refresh, agents_graphify_cli_commands, graphify_out_memory_query_20261028_115613_ea403e90_tecnocasa_features__what_is_already_implemented_an_tecnocasa_feature_audit [INFERRED 0.85]
- **GSAP-driven entrance/motion system (custom, motion-preference aware)** — web_src_components_ui_dialog_dialogcontent, web_src_components_ui_radio_group_radiodot, web_src_components_ui_button_button, web_src_components_ui_checkbox_checkbox, web_src_components_ui_overlays_test_overlaytests [INFERRED 0.85]
- **GSAP matchMedia reduced-motion animation pattern** — web_src_components_page_header_pageheader, web_src_components_site_account_form_accountform, web_src_components_site_home_hero_homehero, web_src_components_site_home_sections_countup, web_src_components_site_listing_gallery_listinggallery [INFERRED 0.85]
- **Industrial Maintenance Asset Management App – Admin Flow (login/approval, users, machines, ITV, OT)** — infra_amplify_data_metrics_pfe_img_p19_im3_login_pending_approval_screen, infra_amplify_data_metrics_pfe_img_p19_im4_user_management_screen, infra_amplify_data_metrics_pfe_img_p20_im5_registration_requests_screen, infra_amplify_data_metrics_pfe_img_p20_im6_machines_dashboard_screen, infra_amplify_data_metrics_pfe_img_p21_im7_add_machine_modal, infra_amplify_data_metrics_pfe_img_p22_im9_itv_approvals_screen, infra_amplify_data_metrics_pfe_img_p22_im8_work_order_management_screen [INFERRED 0.85]
- **Intervention Lifecycle Flow (AI-assisted DI creation → CHEFTECH approval → OT execution & completion)** — infra_amplify_data_metrics_pfe_img_p77_im55_pdca_workflow_board, infra_amplify_data_metrics_pfe_img_p86_im60_intervention_request_wizard, infra_amplify_data_metrics_pfe_img_p86_im61_intervention_approval_list, infra_amplify_data_metrics_pfe_img_p87_im62_ot_completion_wizard [INFERRED 0.85]
- **Lease lifecycle drives notifications, calendar events, registration deadlines and dashboard KPIs** — web_src_i18n_messages_en_leases_leaselifecycle, web_src_i18n_messages_en_leases_registrationworkflow, web_src_i18n_messages_en_notifications_notificationkinds, web_src_i18n_messages_fr_calendar_calendarmessages, web_src_i18n_messages_fr_dashboard_dashboardkpis [INFERRED 0.85]
- **Lease lifecycle UI logic (tabs, grace, flags, registration)** — web_src_lib_lease_types_leaseoverviewrow, web_src_lib_leases_matchesleasetab, web_src_lib_leases_ispastgrace, web_src_lib_leases_leaseflags, web_src_lib_leases_describeregistration, infra_amplify_data_lambda_domain_dates_daysbetween [INFERRED 0.85]
- **Locale parity architecture: fr is the type-checked master, en/ar mirror it, test enforces runtime parity** — web_src_i18n_messages_ar_index_ar_locale_bundle, web_src_i18n_messages_en_index_en_locale_bundle, fr_typed_reference_contract, web_src_i18n_messages_calendar_parity_test_calendarparitytest [INFERRED 0.85]
- **Lock-table versioned optimistic concurrency (UNITLEASE# / UNITOWN# / UNIQ# / COVER# locks)** — infra_amplify_data_lambda_domain_db_versionbump, infra_amplify_data_lambda_domain_db_transact, infra_amplify_data_lambda_domain_leases_commitoccupancychange, infra_amplify_data_lambda_domain_ownerships_changeownerships, infra_amplify_data_lambda_domain_places_createunit, infra_amplify_data_lambda_domain_files_linkfile [INFERRED 0.85]
- **Org-scoped reads loaded per organization and joined in memory into the web's query result shapes** — infra_amplify_data_lambda_api_org_data_helpers, infra_amplify_data_lambda_api_query_eval_evaluator, api_ops_places_placeOps, api_ops_people_peopleOps, api_ops_public_publicOps [INFERRED 0.85]
- **Public-site request management flow (rental + visit requests)** — baux_demandes_RentalRequestsPage, visites_VisitsPage, baux_demandes_test_RentalRequestsPageTests, visites_test_VisitsPageTests [INFERRED 0.85]
- **Reduced-motion-aware GSAP animation pattern with matchMedia test stubs** — web_src_lib_use_control_motion_usecontrolmotion, web_src_lib_use_entrance_useentrance, web_src_test_setup_matchmediastub, web_src_test_motion_media_stubmotionpreference [INFERRED 0.85]
- **Server-side file storage pipeline (verify, resolve bucket, S3, registry)** — web_src_lib_server_auth_requiresession, web_src_lib_server_auth_requirewriter, web_src_lib_server_file_ownership_resolvestoragekeybucket, web_src_lib_server_s3_client_s3, web_src_lib_server_storage_registry_registerstoragefile, web_src_lib_server_storage_registry_forgetstoragefile [INFERRED 0.85]
- **Tunis time zone discipline for lease and calendar dates** — infra_amplify_data_lambda_domain_dates_todaytunis, web_src_lib_calendar_toeventinput, web_src_lib_leases_matchesleasetab [INFERRED 0.85]
- **Web Vitest coverage enforcement pipeline (jsdom setup -> guarded lib/theme modules -> 80% thresholds)** — web_vitest_config_jsdomsetup, web_vitest_config_coveragetargets, web_vitest_config_coveragethresholds [INFERRED 0.85]
- **Unit website publication pipeline: unit form fields feed blocker rules checked in listings/units cards, output shown on the public site** — web_src_i18n_messages_en_properties_propertymessages, web_src_i18n_messages_en_listings_websitepublication, web_src_i18n_messages_en_units_unitmessages, web_src_i18n_messages_en_site_publicsitemessages [INFERRED 0.85]
- **Soft archive/restore lifecycle via archived_at toggle** — biens_detail_PropertyDetailPage, biens_archives_ArchivedPropertiesPage, biens_unit_detail_UnitDetailPage, contacts_detail_ContactDetailPage [INFERRED 0.90]
- **Batch integration tests drive operations through dispatch against Floci dev tables** — infra_amplify_data_lambda_api_places_int_test, infra_amplify_data_lambda_api_people_int_test, infra_amplify_data_lambda_api_leases_ops_int_test, infra_amplify_data_lambda_api_office_ops_int_test, infra_amplify_data_lambda_api_public_int_test, infra_amplify_data_lambda_api_dispatch_dispatch [INFERRED 0.90]
- **Next.js Starter Placeholder Assets** — web_public_file_svg_nextstartericon, web_public_globe_svg_nextstartericon, web_public_next_svg_nextlogo, web_public_vercel_svg_vercellogo, web_public_window_svg_nextstartericon [INFERRED 0.90]
- **PublicListing read-model sync: many writers converge on one listing per unit** — infra_amplify_data_lambda_domain_public_listings_syncpubliclisting, infra_amplify_data_lambda_domain_leases_commitoccupancychange, infra_amplify_data_lambda_domain_places_updateunit, infra_amplify_data_lambda_domain_files_unlinkfile, infra_amplify_data_lambda_domain_public_listings_resyncallpubliclistings [INFERRED 0.90]

## Communities (272 total, 79 thin omitted)

### Community 1 - "Appearance Settings UI"
Cohesion: 0.05
Nodes (94): effectiveColors, ThemeStorage interface (DB-migration seam), Oklch, GeneratedTheme, Scheme, ThemeSeed, TokenMap, ColorRole (+86 more)

### Community 107 - "Calendar Component Tests"
Cohesion: 0.23
Nodes (11): BranchOption, CalendarFilterState, StaffOption, CalendarLookups, useCalendarLookups (staff + branches), EMPTY_FILTERS, BRANCHES, CONTACTS (+3 more)

### Community 12 - "Storage S3 API Routes"
Cohesion: 0.08
Nodes (48): UploadDeps (upload/remove/link port), Item, Props, Photo, Loaded, DocumentCategory, FileKind, FileTarget (+40 more)

### Community 15 - "Theme & Fonts Setup"
Cohesion: 0.07
Nodes (42): MESSAGES registry (fr is the reference dictionary), Direction, Locale, /compte/visites — client's own visit-requests status page (noindex), I18nProvider / useI18n / useT, MotionProvider(), renderIn(), dirOf() (+34 more)

### Community 2 - "AppSync Dispatch & Events"
Cohesion: 0.05
Nodes (78): Op registry model and role sets (STAFF, WRITERS, CLIENT, ANYONE), Caller (authorizer resolverContext), AppSyncArgs, AppSyncEvent, Direction, OrderBy, Row, Where (+70 more)

### Community 21 - "Maps & Incomplete Records"
Cohesion: 0.09
Nodes (32): PropertyDetails type, PropertyUnit type, DashboardData, HomeListingsSection (latest rent/sale listings grid), DashboardPage(), AnimatedNumber(), GrowBar(), HoverLift() (+24 more)

### Community 23 - "Public Listing Pages"
Cohesion: 0.10
Nodes (41): ListingDetails / ListingDetailsRow (migration 0007 detail fields), ListingDetailsRow, NumberLike, CountResult, ListingRow, PublicUnitType, SearchResult, Where (+33 more)

### Community 24 - "Requests & Visits Pages"
Cohesion: 0.11
Nodes (38): Rental request (public-site visitor request type), Visit request (half-hour slot, links to appointment), Step, RentalStatus, RequestBase, RequestUnit, VisitStatus, RequestCard (shared rental/visit request card with staff note) (+30 more)

### Community 3 - "Booking & Public UI Tests"
Cohesion: 0.05
Nodes (80): requestErrorCode (DB error message -> dialog code), RequestKind, AccountErrors, AccountInput, AccountProblem, Raw, RequestResult, TakenSlot (+72 more)

### Community 30 - "AppSync Appointment Handlers"
Cohesion: 0.12
Nodes (33): leaseFlags (ending soon / grace / registration), Lease / LeaseRent / LeaseTerm model, CurrentRent, RegistrationState, LeaseRent, UnitContext, Draft, Notification (+25 more)

### Community 34 - "Request Rules & Validation"
Cohesion: 0.12
Nodes (30): DomainError (keeps Postgres error codes for web/src/lib/errors.ts), cleanContact() contact validation, TxItem, ContactInput, Kind, Receipt, pick (allow-list untrusted patches), assertRentalTerms() rental date/duration rules (+22 more)

### Community 37 - "Public Listing Pages"
Cohesion: 0.11
Nodes (23): PublicListing / ListingRow (public_listings view row + camelCase shape), ListingPageProps, POST /api/auth — action dispatcher (signin, newpassword, signup, confirm, forgot, resetpassword, refresh, signout) to Cognito; assigns custom:role=client server-side, /compte/connexion — client sign-in page (AccountForm mode=signin, Suspense), /compte/inscription — client sign-up page (AccountForm mode=signup), /compte/mot-de-passe-oublie — site forgotten-password page (ResetPasswordForm variant=site), ListingSkeleton, SearchSkeleton (+15 more)

### Community 38 - "Appointment Dialog & Mutations"
Cohesion: 0.17
Nodes (28): AppointmentFields type (writable appointment columns), AppointmentInitial (dialog seed type), Props, ParticipantInput, AppointmentFormValues, AppointmentDialog (create/edit dialog), AppointmentForm (react-hook-form + zod submit logic), StaffConflictWarning (warns when assigned staff is busy) (+20 more)

### Community 42 - "Leaflet Maps"
Cohesion: 0.17
Nodes (21): occupancyLevel — classify units into none/empty/partial/full, ListingMapPoint, MapPoint, ListingsMapInner (public search map with price pins), pinIcon (SVG Leaflet pin), PropertiesMapInner (ERP properties map with occupancy colors), priceIcon(), ClickToPlace() (+13 more)

### Community 43 - "Units Filtering Logic"
Cohesion: 0.12
Nodes (26): UnitCardData (unités overview card shape), UnitFilters, WebsiteFilter, Amenity, WebsiteBlocker, WebsiteInput, filterUnits (search/status/property/website filters), unitBlockers (what keeps a unit off the website) (+18 more)

### Community 5 - "Public Home Hero & Filters"
Cohesion: 0.08
Nodes (59): SearchFilters / SearchMode types, Quick, PageItem, ActiveFilter, SearchView, RawSearchParams, SearchMode, SearchSort (+51 more)

### Community 52 - "Auth Provider & Session"
Cohesion: 0.18
Nodes (24): AuthSession / AuthUser types, accountErrorKey — Cognito error code to wording key, AuthState, PendingPasswordChange, AuthError, Listener, SignInResult, AuthUser (+16 more)

### Community 53 - "Appointment Details & Editor"
Cohesion: 0.16
Nodes (20): AppointmentDetails type, Appointment string unions (kind, status, participant role, email status), Props, Props, AppointmentStatus, EmailStatus, ParticipantRole, Slot (+12 more)

### Community 54 - "Theme Icons & Palette"
Cohesion: 0.15
Nodes (23): NotificationKind union (8 notification kinds), ItemProps, NotificationRow, NotificationsData, NotificationBell (header dropdown, unread badge), usePollingReloadKey (60s polling, paused when tab hidden), formatNotificationTime — Tunis time, current locale, notificationHref — link > lease > appointment > dashboard fallback (+15 more)

### Community 63 - "Ownership Rules"
Cohesion: 0.22
Nodes (20): Ownership / OwnerShare model, OwnerShare, OwnershipChange, ensureContactRole (idempotent owner/renter role append), rangesOverlap (inclusive), versionBump (Lock-table optimistic concurrency), assertNoContactOverlap, currentOwners (snapshot for today) (+12 more)

### Community 66 - "Unit Filtering"
Cohesion: 0.21
Nodes (19): CalendarViewName (month/week/list), dateFromParam (validated date param), paramFromView (view name to ?vue=), viewFromParam (?vue= to view name), visibleRange (Monday-first visible days), addDays, CalendarPage(), CalendarPageBody() (+11 more)

### Community 7 - "Lease-Contact Components"
Cohesion: 0.08
Nodes (56): LeaseDetails type, LeaseDraftInput (lease form state), LeaseOverviewRow (lease_overview view row), DraftLease, LeaseTabName, Row, Props, FlagRow (+48 more)

### Community 77 - "Calendar Feed Hook"
Cohesion: 0.19
Nodes (18): FeedRow (calendar_feed view row shape), CalendarFilters, RawFeedRow, LeaseEventKind, normalizeFeedRow (contact_ids normalization), useCalendarFeed (visible-range feed rows), useFeedRows (filtered feed rows), calendarRangeQuery (+10 more)

### Community 8 - "Lease Draft Editing"
Cohesion: 0.08
Nodes (49): LeaseDocumentCategory keys, PropertyTab, UnitDetails, Doc, Props, Doc, ErrorContext, Settled (+41 more)

### Community 91 - "Appointment Decisions Logic"
Cohesion: 0.22
Nodes (11): RowChangeEvent (op, old/new row, table, trigger), AppointmentAction, ParticipantAction, ParticipantContext, decideAppointmentAction(), decideParticipantAction(), parseEvent() body narrowing, sameValue() (+3 more)

### Community 97 - "Misc Utilities"
Cohesion: 0.21
Nodes (13): MailDeps / Mailer (SMTP via Secrets Manager), Mailer, StreamEvent, missingVariable() 500 without value leak, resolveSecretEnv() Secrets Manager with warm-container cache, resolveMailer() SMTP env assembly, fromStreamRecord (DynamoDB stream -> ChangeRecord), handleChange (stream change dispatcher) (+5 more)

### Community 0 - "Lease & Calendar Operations"
Cohesion: 0.03
Nodes (85): Org, dispatch(): op lookup, kind check, role check, run, useDevTables() Floci test bootstrap, parseVariables(), distinctOn(), call(), publicListingsOf(), Integration test batch 3: leases through the dispatcher on Floci (+77 more)

### Community 10 - "Maps & Incomplete Records"
Cohesion: 0.07
Nodes (52): ContactDetails, ContactAppointment, Participation, Row, ListingRow, VisitRow, Props, I18nValue (+44 more)

### Community 101 - "Charts & Recharts"
Cohesion: 0.21
Nodes (14): ChartConfig, ChartContextProps, TooltipNameType, ChartContainer, ChartLegendContent, ChartTooltipContent, ChartStyle(), getPayloadConfigFromPayload() (+6 more)

### Community 102 - "Common Areas & CRUD Lists"
Cohesion: 0.29
Nodes (12): NewOwner, OwnershipRow, TransferPlan, ownershipPhase / isCurrent — past, current, upcoming holdings, planTransfer — end running holdings, start new owners on a date, rowsToReopen — reopen holdings closed by a cancelled transfer, validateNewOwners — 100% co-ownership share validation, dayBefore() (+4 more)

### Community 11 - "Lease Rules Engine"
Cohesion: 0.09
Nodes (50): DraftInput, LeaseStatus, LeaseTerm, PartyInput, RentInput, isIsoDate, assertActivatable (activate_lease preconditions), assertEndable (end_lease) (+42 more)

### Community 112 - "Unit Filtering"
Cohesion: 0.24
Nodes (10): Props, CalendarEventInput, CalendarView (FullCalendar wrapper), tunisToIso, dayOf(), slotToIso(), wallClock(), CALENDAR_STYLES (token-based FullCalendar skin) (+2 more)

### Community 114 - "Appointment List UI"
Cohesion: 0.32
Nodes (10): AppointmentListItem, Props, RangeParts, appointmentHref (calendar deep link with date), formatLongDay, formatRange (range parts for LTR times), formatShortDay, formatTime (+2 more)

### Community 121 - "Public Buy/Rent Pages"
Cohesion: 0.31
Nodes (8): SearchPageProps, /acheter — public sale search page (SearchPage mode=sale), /louer — public rent search page (SearchPage mode=rent), searchMetadata, components/site/search-page — shared public search page component (searchMetadata, SearchPageProps), generateMetadata(), generateMetadata(), searchMetadata test suite

### Community 122 - "Empty Concepts"
Cohesion: 0.42
Nodes (9): Props, CalendarEmptyState, Empty state (component family), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), EmptyTitle() (+1 more)

### Community 123 - "Appointment Sheet UI"
Cohesion: 0.33
Nodes (10): resetErrorKey, ResetStep, confirmPasswordReset(), requestPasswordReset(), toErrorKey(), usePasswordReset(), confirm(), requestCode() (+2 more)

### Community 14 - "Contacts & Appointments Rules"
Cohesion: 0.11
Nodes (52): AppointmentInput, Bucket, FileTarget, LinkInput, ResolvedTarget, deleteAppointment: cascade delete participants + drop reminders, resendInvitation: reset participant email_status to pending, saveAppointment: create/update appointment + participants in one transaction (+44 more)

### Community 17 - "App Sidebar & Navigation"
Cohesion: 0.09
Nodes (45): Props, Props, SidebarContextProps, AppSidebar (ERP navigation + user menu/sign-out), NavEntry (collapsible sidebar navigation item), setAppointmentStatusMutation, AppointmentSheet (side panel shell), AppointmentSheetContent (detail + actions) (+37 more)

### Community 18 - "Maps & Incomplete Records"
Cohesion: 0.15
Nodes (39): Row, Props, Props, LeaseForCalendar, Row, MethodValue, OrgRow, ColorField (color picker + validated hex input) (+31 more)

### Community 20 - "Storage S3 API Routes"
Cohesion: 0.13
Nodes (34): Operation, Reply, SessionClaims, OwnershipData, POST /api/data — same-origin relay to AppSync (no CORS upstream); passes caller token unchanged, falls back to PUBLIC_TOKEN, lib/backend appsyncRequest + PUBLIC_TOKEN — AppSync GraphQL request helper, lib/server/auth requireSession — JWT session verification from Authorization header, lib/server/auth requireWriter — writer-role gate on session claims (+26 more)

### Community 25 - "Common Areas & CRUD Lists"
Cohesion: 0.16
Nodes (32): CommonArea, Editing, Props, Photo, Props, Props, Props, ConfirmDialog (+24 more)

### Community 26 - "Unit Dialog Form"
Cohesion: 0.08
Nodes (35): PropertyFormValues, Props, FormValues, PropertyOption, Props, UnitFormUnit, FlowStep, Option (+27 more)

### Community 29 - "Auth Claims & Resolver Context"
Cohesion: 0.09
Nodes (32): AuthorizerEvent, Lambda AppSync authorizer handler (JWT verify, public token literal), cacheSeconds(), toResolverContext(), authorizerChecks(), caller(), callOp(), check() (+24 more)

### Community 33 - "UI Primitives & Icons"
Cohesion: 0.13
Nodes (27): IconAnimation, IconProps, LucideIcon, IconName, IconNode, ControlMotion, AnimatedIcon, makeIcon factory (+19 more)

### Community 36 - "Contact Form"
Cohesion: 0.14
Nodes (29): ContactFormValues, Props, DuplicateCandidate, DuplicateField, DuplicateInput, DuplicateMatch, ContactForm, DuplicateNotice (+21 more)

### Community 4 - "Leases & Properties Lists"
Cohesion: 0.10
Nodes (59): Property, StatusFilter, Unit, Row, Contact, PropertyRow, Parsed, ShareUnit (+51 more)

### Community 47 - "Calendar Toolbar & Dates"
Cohesion: 0.14
Nodes (19): Props, dateFromIso (yyyy-mm-dd to local Date), isoFromDate (local Date to yyyy-mm-dd), CalendarToolbar (nav, date picker, view switch), ShareButton (copy / WhatsApp), Calendar (DayPicker wrapper), Popover (component family), pageUrl() (+11 more)

### Community 48 - "Calendar Toolbar & Dates"
Cohesion: 0.16
Nodes (21): ContactHit, ContactOption, Props, Props, CommandPalette (Cmd+K search), ContactPicker (searchable combobox for contacts), OwnersEditor (share rows, 100% total validation), Command (cmdk palette) (+13 more)

### Community 58 - "Playwright Specs"
Cohesion: 0.18
Nodes (15): NewUnit, addUnit(), createBien(), isoInDays(), pickContact(), signIn(), PNG, CACHE_WINDOW (+7 more)

### Community 59 - "Appointment Sheet UI"
Cohesion: 0.12
Nodes (22): Variant, NewPasswordErrors, NewPasswordInput, ResetProblem, ResetPasswordForm (two-step forgot password, ERP + site variants), handleConfirm(), handleRequest(), askForCode() (+14 more)

### Community 6 - "Test Harness & Vitest"
Cohesion: 0.04
Nodes (42): Participation, Row, QueryState, Harness(), setup(), renderSignedIn(), renderSignedIn(), base (+34 more)

### Community 60 - "Lease Draft Editing"
Cohesion: 0.18
Nodes (18): ArchivedProperty, PropertyRow, ContactRow, ContactRole, PageHeader (ERP page title with GSAP masked title animation), ArchivedPropertiesPage(), longDate(), EditPropertyPage() (+10 more)

### Community 62 - "GraphQL Query Modules"
Cohesion: 0.18
Nodes (13): PluralForms, plural() CLDR plural picker, FR units section dictionary (unit cards, publication blockers), dashboard, properties, units, dashboard, properties (+5 more)

### Community 64 - "Places Domain: Properties & Units"
Cohesion: 0.22
Nodes (23): Rule, checkColumns(), codeLockId(), createCommonArea(), createProperty(), createUnit(), deleteCommonArea(), deleteUnit() (+15 more)

### Community 67 - "Visitor Requests Backend"
Cohesion: 0.16
Nodes (19): SiteFooterProps, (site)/layout — public front-office frame: header, #contenu main, footer, always light, French-only metadata, components/site/site-footer — public site footer (#contact, agency phone/email/address), components/site/site-header — public site header, SiteLogo, ContactRow(), SheetClose(), SheetContent() (+11 more)

### Community 68 - "Calendar Page"
Cohesion: 0.24
Nodes (20): Body, InvalidRequest, AuthenticationResult, CognitoError, lib/server/cognito — Cognito Identity Provider client (cognito, clientId, userPoolId, toSession, CognitoError), toSession — Cognito result to browser session (client→user role), confirm(), forgot() (+12 more)

### Community 70 - "Placeholder Pages"
Cohesion: 0.12
Nodes (20): Crumb, NavChild, NavGroup, NavItem, NavKey, NavMessages, /erp/(app)/[...slug] — catch-all placeholder page for NAVIGATION entries without a real page, buildCrumbs — breadcrumb trail from a pathname (+12 more)

### Community 73 - "ERP Auth Pages & Config"
Cohesion: 0.18
Nodes (18): LegacyRedirect, ERP Forgot Password Page (/erp/mot-de-passe-oublie), AuthSplitLayout (brand panel + form frame for auth pages), InputGroupButton, erpPath (/erp prefixing), legacyRedirects (old ERP paths), safeNext (post-sign-in target), ConnexionForm() (+10 more)

### Community 76 - "Public Listing Pages"
Cohesion: 0.14
Nodes (15): ResultsProps, SearchMap, toMapPoints, AlertCard (Créer une alerte, disabled), Tooltip UI primitive (Radix), renderCard(), listings(), makeListing() (+7 more)

### Community 78 - "Visit Booking Forms"
Cohesion: 0.16
Nodes (14): FieldLabelWithHelpProps, LeaseFormInitial, Props, Props, Props, UnitOption, LeaseUnitInput, FieldHelp (ⓘ popover) (+6 more)

### Community 82 - "Appointment Labels"
Cohesion: 0.18
Nodes (17): GapEntity, GapGroup, GapRow, participantEmailLabel, gapLabel (data-gap codes), gapLink (fix-it route per gap), groupGaps, getMessages() (+9 more)

### Community 88 - "ERP Auth Pages & Config"
Cohesion: 0.22
Nodes (14): Props, Fetcher, GeocodeResult, LatLon, LocationField (geocode search + map position picker), buildGeocodeUrl (Tunisia-limited query), geocodeAddress (Nominatim search), roundPosition (numeric(9,6) storage) (+6 more)

### Community 9 - "Visit Booking Forms"
Cohesion: 0.11
Nodes (52): UnitRow, ParticipantRow, Props, Props, Props, EndLease, RenewLease, AppointmentFormFields (dialog field composition) (+44 more)

### Community 92 - "Mailer & SMTP"
Cohesion: 0.20
Nodes (11): Mailer, MailerConfig, MailMessage, CoreResult, Env, Resolved, createMailer() nodemailer sender, smtpTransportOptions() (465 implicit TLS / STARTTLS) (+3 more)

### Community 94 - "Favorites & Charts"
Cohesion: 0.17
Nodes (12): Loaded, /favoris — visitor favourites page (device-local, client-side), components/site/favorites-page — browser-stored favourites view, favoriteListingsAction (listings behind browser favorites), renderDialog(), metadata, Heart, actions (+4 more)

### Community 96 - "Misc Utilities"
Cohesion: 0.18
Nodes (13): MailContent, appointmentMail() invitation/update/cancellation, notificationMail() French notification mail, absoluteLink(), formatDate(), APPOINTMENT_INTROS, APPOINTMENT_KINDS, APPOINTMENT_SUBJECTS (+5 more)

### Community 99 - "Mail Events & Change Records"
Cohesion: 0.23
Nodes (14): Appointment, ChangeRecord, MailKind, Participant, StreamRecord, onAppointment (update/cancel/invite_all), onNotification (mail bell notifications), onParticipant (invitation / resend) (+6 more)

### Community 27 - "Listing Details UI"
Cohesion: 0.13
Nodes (33): ListingCard (catalog grid card, one stretched link + floating heart), useAvailableFromFuture (SSR-safe availability check via useSyncExternalStore), ListingAmenities (known catalog amenities only), ListingConditions (rent terms / sale price and reservation), ListingDescription (agency free text), ListingDocuments (tenant document checklist, rent only), ListingFeatures (condition, year, floors, outdoor area, orientation, energy class), ListingLocation (map pin rounded to 3 decimals for privacy) (+25 more)

### Community 32 - "App Header & Breadcrumb"
Cohesion: 0.10
Nodes (24): AppHeader (breadcrumbs, palette, theme, language, notifications), Breadcrumb (component family), ButtonGroup, Progress, ScrollArea UI primitive (Radix), Separator UI primitive (Radix), Toggle UI primitive (toggleVariants), BreadcrumbEllipsis() (+16 more)

### Community 46 - "Common Areas & CRUD Lists"
Cohesion: 0.12
Nodes (27): graphql (AppSync gateway call), restore(), toggleArchive(), Fact(), UnitDetailPage(), remove(), update(), BiensPage() (+19 more)

### Community 61 - "Theme Icons & Palette"
Cohesion: 0.19
Nodes (17): ThemeGlyph (sun/moon morph header icon), LanguageSwitcher, ThemeToggle, DropdownMenu (component family), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuRadioGroup() (+9 more)

### Community 69 - "App Layout & Motion"
Cohesion: 0.15
Nodes (18): AppShell (ERP session gate + sidebar/header layout), useAuth hook, ScrollProgress (reading-progress bar), ScrollStagger (app-wide GSAP scroll reveal), SmoothScroll (eased mouse-wheel scrolling), stubMotionPreference (matchMedia test stub), AppLayout(), PageTransition() (+10 more)

### Community 79 - "UI Primitives & Icons"
Cohesion: 0.17
Nodes (11): ListingGallery (main photo + thumbs, viewer, virtual tour), lib/site/image-url publicImageUrl — public cover image URL builder (OG images), safeTourUrl (http(s)-only tour link), GalleryPhoto(), photoIds(), thumbSpan(), Tests: public-api, Camera (+3 more)

### Community 105 - "Load Test Script"
Cohesion: 0.15
Nodes (12): call(), worker(), CONC, cw, env, lat, now, readback (+4 more)

### Community 106 - "Metrics Kinesis Dashboard"
Cohesion: 0.14
Nodes (10): dashboard, deploy, inventory, kinesis, lamLogs, load, logsAudit, readBack (+2 more)

### Community 111 - "Tecnocasa Prototype Scripts"
Cohesion: 0.19
Nodes (8): dropPercent(), listingCardHtml(), pickSimilar(), sameCity(), tnd(), AGENCY, ICON, STORE

### Community 119 - "Backend Concepts"
Cohesion: 0.18
Nodes (9): api, apiFn, backend, dailyFn, MAILED_MODELS, mailerFn, ROOT, schedulerRole (+1 more)

### Community 120 - "Two-Org Isolation Demo"
Cohesion: 0.25
Nodes (9): cognito(), createStaffAccount(), put(), seedAgency(), table(), verifyLogin(), A, B (+1 more)

### Community 153 - "Theme & Fonts Setup"
Cohesion: 0.52
Nodes (6): Toaster(), CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon

### Community 161 - "Calendar Page"
Cohesion: 0.33
Nodes (3): post(), /api/auth route tests — forgot (anti account-probing, rate-limit passthrough) and resetpassword flows, fetchMock

### Community 22 - "Infra Dependencies & CDK"
Cohesion: 0.06
Nodes (42): dependencies, jose@^6.2.13, description, devDependencies, @aws-amplify/backend@^1.25.1, @aws-amplify/graphql-api-construct@^1.22.3, aws-cdk@^2.1146.1, aws-cdk-lib@^2.274.0 (+34 more)

### Community 50 - "Ops Scripts & Health Checks"
Cohesion: 0.07
Nodes (18): artifactizer, L, mailer, appsync, cfg, cfn, dynamo, iam (+10 more)

### Community 51 - "CloudFormation Deploy"
Cohesion: 0.09
Nodes (16): @aws-sdk/client-cloudformation@^3.1156.0, ENVS, name, OUT, cw, deploySec, out, readback (+8 more)

### Community 57 - "Logs & Metrics Scripts"
Cohesion: 0.08
Nodes (20): l, seen, l, errAll, firstE, groups, jsonPath, lam (+12 more)

### Community 65 - "Backup Tooling"
Cohesion: 0.17
Nodes (23): backup(), canonical(), describe(), drill(), getObject(), listObjects(), listTables(), mailProne() (+15 more)

### Community 75 - "Dynamo & Persistence Tooling"
Cohesion: 0.15
Nodes (20): docker(), dockerQuiet(), lambdaZip(), record(), run(), seed(), sleep(), startContainer() (+12 more)

### Community 87 - "Backup Integration Tests"
Cohesion: 0.12
Nodes (10): gsiTable(), makeTables(), apis, buckets, cfg, CORS, dynamo, s3 (+2 more)

### Community 95 - "AWS SDK Patch Tooling"
Cohesion: 0.25
Nodes (10): clientConfig(), dropEmptyIdentityRegex(), fillPlaceholders(), main(), patchDir(), patchNode(), patchVersions(), updateTree() (+2 more)

### Community 115 - "Notifications Concepts"
Cohesion: 0.23
Nodes (8): FR notifications dictionary (bell, unread, kinds), FR shell dictionary (header, login, reset password, auth errors), notifications, shell, notifications, shell, notifications, shell

### Community 152 - "ERP Auth Pages & Config"
Cohesion: 0.33
Nodes (7): Next.js Configuration (cacheComponents, legacy redirects, Turbopack), Calendar Appointment E2E Flow, Core Records E2E Flow (bien, units, ownership, photos, map pin), Front Office Publishing E2E Flow, Playwright E2E Helpers (signIn, createBien, addUnit, pickContact), i18n / RTL Language Switcher E2E Flow, Lease Lifecycle E2E Flow (draft, activate, renew, end)

### Community 156 - "Floci Concepts"
Cohesion: 0.33
Nodes (6): Authorizer Lambda (Cognito JWT via floci JWKS), Floci local AWS backend (Cognito/JWKS, AppSync, Secrets Manager), docker compose web/test/e2e dev stack, ErpApi Amplify GraphQL API (DynamoDB, Lambda resolvers), Notification TTL spec (expires_at), Batch 4 calendar/notifications integration test

### Community 167 - "Ownership Concepts"
Cohesion: 0.47
Nodes (4): FR ownership dictionary (unit owners, transfer, co-owner), ownership, ownership, ownership

### Community 35 - "Dev & Testing Dependencies"
Cohesion: 0.06
Nodes (33): ESLint Flat Config (Next core-web-vitals + TypeScript), devDependencies, eslint@^9, eslint-config-next@16.4.0, jsdom@^30.1.2, @playwright/test@^1.64.1, tailwindcss@^4, @tailwindcss/turbopack@^4 (+25 more)

### Community 41 - "Calendar Notifications DB"
Cohesion: 0.14
Nodes (25): auth.user_roles (JWT allowed roles per user), auth.users (local stand-in table for auth schema), appointment_participants_contact_idx, appointment_participants_set_updated_at, appointments_check_staff, appointments_drop_stale_reminders, appointments_lease_idx, appointments_org_starts_idx (+17 more)

### Community 49 - "Storage Buckets & Listings Schema"
Cohesion: 0.11
Nodes (25): storage.buckets (local stand-in, includes 'default' bucket), storage.files (local stand-in for legacy cloud storage files), public_listings view (0005: listings joined to units/properties/photos, rounded coords), leases_close_rent_listings, listings_check_publishable, listings_set_updated_at, public.close_listings_on_unit_archived(), public.close_rent_listings_on_lease_active() (+17 more)

### Community 89 - "Requests & Visit Settings Ops"
Cohesion: 0.20
Nodes (10): FR requests dictionary (rental requests, visits in the ERP), FR visit settings dictionary (visit payment method admin setting), requests, visitSettings, requests, visitSettings, errors, requests (+2 more)

### Community 108 - "Leases Concepts"
Cohesion: 0.20
Nodes (8): calendar, errors, ar, leases, site, leases, fr, leases

### Community 109 - "Docker Compose Config"
Cohesion: 0.15
Nodes (13): web, command, depends_on, environment, image, init, ipc, network_mode (+5 more)

### Community 110 - "Branches Concepts"
Cohesion: 0.15
Nodes (13): description, options, required, type, environment, on, pull_request, push (+5 more)

### Community 113 - "Tsconfig Concepts"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck, strict (+3 more)

### Community 118 - "Auth Concepts"
Cohesion: 0.18
Nodes (11): APPSYNC_URL, AUTH_COGNITO_URL, AUTH_JWKS_URL, AWS_ACCESS_KEY_ID, AWS_ENDPOINT_URL, AWS_REGION, AWS_SECRET_ACCESS_KEY, E2E_BASE_URL (+3 more)

### Community 126 - "Name Concepts"
Cohesion: 0.20
Nodes (9): external, name, name, networks, floci, services, x-web-build, context (+1 more)

### Community 127 - "Auth Concepts"
Cohesion: 0.20
Nodes (10): APPSYNC_URL, AUTH_COGNITO_URL, AUTH_JWKS_URL, NEXT_WATCH_POLL_MS, web, environment, image, networks (+2 more)

### Community 129 - "Security Concepts"
Cohesion: 0.20
Nodes (10): security-scan, permissions, attestations, contents, id-token, security-events, name, permissions (+2 more)

### Community 13 - "Foundation DB Schema"
Cohesion: 0.07
Nodes (49): branches_set_updated_at, contact_roles_organization_id_idx, contacts_organization_id_idx, contacts_set_updated_at, organizations_set_updated_at, properties_branch_id_idx, properties_organization_id_idx, properties_set_updated_at (+41 more)

### Community 130 - "Environment Concepts"
Cohesion: 0.22
Nodes (10): environment, environment, if, name, runs-on, timeout-minutes, environment, name (+2 more)

### Community 131 - "Permissions Concepts"
Cohesion: 0.24
Nodes (10): if, name, permissions, runs-on, timeout-minutes, deploy-prod, permissions, contents (+2 more)

### Community 136 - "Deploy Concepts"
Cohesion: 0.22
Nodes (8): concurrency, cancel-in-progress, group, env, INFRA_DIR, NODE_VERSION, jobs, name

### Community 137 - "Scripts Concepts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, start, test, test:coverage, test:e2e (+1 more)

### Community 141 - "Steps Concepts"
Cohesion: 0.50
Nodes (8): steps, steps, steps, if, name, run, uses, working-directory

### Community 142 - "Cache Concepts"
Cohesion: 0.25
Nodes (8): with, aws-region, cache, cache-dependency-path, fetch-depth, node-version, role-to-assume, script

### Community 146 - "Build Concepts"
Cohesion: 0.38
Nodes (7): BASE_IMAGE, args, context, build, build, build, args

### Community 148 - "Access Concepts"
Cohesion: 0.29
Nodes (7): AWS_ACCESS_KEY_ID, AWS_ENDPOINT_URL, AWS_REGION, AWS_SECRET_ACCESS_KEY, ERP_COGNITO_POOL_ID, ERP_SECRET_NAME, env

### Community 157 - "Interval Concepts"
Cohesion: 0.33
Nodes (6): interval, retries, start_period, test, timeout, healthcheck

### Community 159 - "Branches Concepts"
Cohesion: 0.33
Nodes (6): on, pull_request, push, workflow_dispatch, branches, branches

### Community 16 - "Calendar & UI Libraries"
Cohesion: 0.05
Nodes (54): dependencies, @aws-sdk/client-s3@^3.1156.0, @aws-sdk/s3-request-presigner@^3.1156.0, class-variance-authority@^0.7.1, cmdk@^1.1.1, cn@^0.4.0, date-fns@^4.4.0, @fullcalendar/core@^6.1.22 (+46 more)

### Community 162 - "Contacts Concepts"
Cohesion: 0.47
Nodes (3): contacts, contacts, contacts

### Community 163 - "Files Concepts"
Cohesion: 0.47
Nodes (3): files, files, files

### Community 164 - "Labels Concepts"
Cohesion: 0.47
Nodes (3): labels, labels, labels

### Community 165 - "Listings Concepts"
Cohesion: 0.47
Nodes (3): listings, listings, listings

### Community 166 - "Misc Community"
Cohesion: 0.47
Nodes (3): nav, nav, nav

### Community 168 - "File Concepts"
Cohesion: 0.60
Nodes (5): env_file, path, required, env_file, env_file

### Community 169 - "Command Concepts"
Cohesion: 0.40
Nodes (5): test, command, image, profiles, volumes

### Community 171 - "Name Concepts"
Cohesion: 0.40
Nodes (5): name, needs, runs-on, timeout-minutes, e2e-tests

### Community 172 - "Name Concepts"
Cohesion: 0.40
Nodes (5): if, name, runs-on, timeout-minutes, deploy-dev

### Community 175 - "Local Concepts"
Cohesion: 0.50
Nodes (4): MSYS_NO_PATHCONV, PATH, run_sql(), db-local.sh script

### Community 176 - "Storage Concepts"
Cohesion: 0.83
Nodes (3): public.app_storage_files, public.check_lease_file_storage(), public.check_property_file_storage()

### Community 177 - "Node Concepts"
Cohesion: 0.50
Nodes (4): volumes, e2e-node-modules, web-next, web-node-modules

### Community 178 - "Name Concepts"
Cohesion: 0.50
Nodes (4): name, runs-on, timeout-minutes, infra-tests

### Community 179 - "Lint Concepts"
Cohesion: 0.50
Nodes (4): lint, name, runs-on, timeout-minutes

### Community 180 - "Type Concepts"
Cohesion: 0.50
Nodes (4): type-check, name, runs-on, timeout-minutes

### Community 19 - "Leases DB Schema"
Cohesion: 0.09
Nodes (43): lease_files_check_storage, lease_files_lease_id_idx, lease_files_organization_id_idx, lease_files_set_updated_at, lease_parties_contact_id_idx, lease_parties_draft_only_delete, lease_parties_ensure_renter_role, lease_parties_organization_id_idx (+35 more)

### Community 40 - "Property & Unit Forms"
Cohesion: 0.12
Nodes (25): public.check_visitor_request(), public.notify_staff_of_request(), public.public_taken_visit_slots, public.rental_requests, public.request_receipt, public.submit_rental_request(), public.submit_visit_request(), public.visit_requests (+17 more)

### Community 55 - "Functions Dependencies"
Cohesion: 0.10
Nodes (25): dependencies, @aws-sdk/client-secrets-manager@^3.1156.0, nodemailer@^7.0.13, devDependencies, archiver@^7.0.1, esbuild@^0.24.0, @types/node@^20.19.43, @types/nodemailer@^7.0.12 (+17 more)

### Community 72 - "UI Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 81 - "Appearance Concepts"
Cohesion: 0.15
Nodes (10): appearance, common, appearance, calendar, common, errors, en, site (+2 more)

### Community 83 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 84 - "CI Steps"
Cohesion: 0.26
Nodes (17): steps, steps, steps, unit-tests, steps, steps, continue-on-error, if (+9 more)

### Community 93 - "CI Lint Config"
Cohesion: 0.12
Nodes (16): with, allow-licenses, cache, cache-dependency-path, category, fail-on-severity, fetch-depth, key (+8 more)

### Community 98 - "CI Workflow"
Cohesion: 0.13
Nodes (14): name, needs, runs-on, timeout-minutes, concurrency, cancel-in-progress, group, env (+6 more)

### Community 103 - "PFE Metrics & Deploy Notes"
Cohesion: 0.15
Nodes (14): PFE: SagemCom EAM predictive-maintenance platform (94-page report), CV notes — measurable backend/PFE metrics and honest-scoping corrections, Timed deploy: cdk synth 95.0 s, idempotent redeploy 61.7 s (ERP/Deploy metrics), AWS resource inventory 2026-10-27 (23 CDK stacks, 20 DynamoDB tables, 76 AppSync pipeline functions, 9 Lambdas, 33 IAM roles), AppSync load test: 147.2 req/s, 0 failures, p95 171.6 ms, CloudWatch Logs audit + error triage (4094 events; bursts = negative tests, warm containers), Unreadable file infra/amplify-data/log-signatures.txt (binary), Kinesis metrics dashboard (HTML cards: tables, stacks, req/s, security checks) (+6 more)

### Community 117 - "Misc Community"
Cohesion: 0.22
Nodes (11): Decisions still to take (8 ADRs: language, framework, cloud, auth…), API first (every screen uses the same REST API), 14 Architecture principles, Business events inside the application (LeaseActivated, PaymentAllocated), Financial history is never rewritten (corrections as new records), Localization from day one (FR / AR right-to-left / EN, TND 3 decimals), Required stack from Phase 0 (PostgreSQL, REST API, Docker, Terraform, CI/CD), Simple first (no Kubernetes / microservices / brokers without a real need) (+3 more)

### Community 128 - "Misc Community"
Cohesion: 0.24
Nodes (10): D-010: MVP is ERP for staff only, no external actor logs in before V1, MVP capabilities by domain (§3 one-paragraph MVP, §4 tables), Open questions (seasonal rentals, taxes/e-invoicing, WhatsApp, sale payment path), Scope tier model (MVP / V1 / V2 / Later / Out / Open), N-06: Charge vs Expense (never 'charge' alone in French), Owner Statement term (Relevé propriétaire, calculation owned by CDC 07), 16 accountant questions (honoraires, TVA, retenue à la source, e-invoicing, bail registration, anti-blanchiment), Owner statement formula (loyers − dépenses − honoraires = net du propriétaire; 900−300−72=528 TND) (+2 more)

### Community 134 - "Misc Community"
Cohesion: 0.22
Nodes (9): Ranked quality priorities (rank 1: isolation between organizations), One shared database with organization ID + row-level security, Two walls of isolation (application wall + database wall), Organization ID isolation diagram (step 3), One database for all organizations (per-org DB decision withdrawn in v0.2), Glossary naming decisions N-01 to N-11, Organization term (real estate company owning real estate; agencies excluded, D-012), N-01: Renter (locataire) vs Tenant (organization) (+1 more)

### Community 147 - "Misc Community"
Cohesion: 0.33
Nodes (7): Background worker (same code, another mode: rent generation, reminders, PDF), 14 Business Modules catalog, Jobs can safely run twice (rent generation, reminders), Modular Monolith (architecture style), Operator back office (platform operator, no business data access), Big picture diagram (step 1: who uses the system), Building blocks diagram (step 2: platform composition)

### Community 104 - "Misc Utilities"
Cohesion: 0.20
Nodes (14): Core records delivery (15 tasks done, 63 tests, live backend applied), Migration 0002 core records (ownerships, property_files, common_areas, record_gaps views), Effective-dated ownership design (shares ≤100%, deferred constraint trigger, exclusion constraint), record_gaps view / Fiches incomplètes (no_owner, no_surface, shares_total…), Leases Plan A delivery (tasks 0–15, migration 0003, live steps pending), Draft-only guard trigger + erp.lease_action transaction flag, Lease SECURITY DEFINER functions (activate, renew, end, change_rent, expire_overdue_leases), lease_rule thresholds (grace 7, ending_soon 60, registration 60, warning 10) (+6 more)

### Community 135 - "Misc Community"
Cohesion: 0.25
Nodes (9): ERP moved under /erp with redirects from old links, Listing Publication card on unit (create/publish/pause/close, migration 0005 listings), Public vitrine site (/, /louer, /acheter, /logement/<id> with public role), Abuse protection (per-phone rate limits, honeypot; known gap: per-IP + CAPTCHA missing), Visitor requests (rent requests, viewing requests, favorites, /erp/baux/demandes, /erp/visites), Tecnocasa.tn competitor analysis (REA controlled-replay, 4 scenarios), Roadmap: rate-limit + CAPTCHA hardening of public mutations, Roadmap: ±25% similar-listings query (own proposal, not competitor copy) (+1 more)

### Community 132 - "Misc Community"
Cohesion: 0.24
Nodes (10): Floci infrastructure inventory (2026-10-27), CloudWatch logs audit (2026-10-27), Deploy timing metrics (2026-10-27), Metrics dashboard aggregate (erp-metrics), AppSync load test results (PublicLatestListings, 147.2 rps), package.json (erp-amplify-data scripts), backup restore integration tests, backup.mjs logical backup/drill/restore tool (+2 more)

### Community 158 - "Misc Community"
Cohesion: 0.40
Nodes (6): Cognito error-code mapping fix (accountErrorKey: dead Nhost codes → Cognito codes), Floci cutover (Nhost → self-hosted AppSync + Lambda + DynamoDB + S3 + Cognito + EventBridge), Nhost/Hasura repo purge (83 files; applied SQL identifiers and wire contract kept), Hasura-shaped wire contract deliberately kept ($where, _ilike, by_pk, affected_rows), Foundation tables (organizations, branches, properties, units, contacts, contact_roles), Multi-tenant rule (organization_id everywhere, composite FKs, AppSync JWT filter)

### Community 28 - "Agent Instructions & Graph Policy"
Cohesion: 0.08
Nodes (35): Rate-Limit / CAPTCHA Gap on Public AppSync Endpoint, Similar Listings ±25% Already Implemented, WhatsApp Click-to-Chat Agent Contact Missing, Query Memory: Tecnocasa Features — Implemented vs Missing, refuse() Decision Logging Helper, Visit Request Submit Handler, applyPrice() Price Revision Handler, renderPublic() Price-Drop Badge (+27 more)

### Community 100 - "Misc Utilities"
Cohesion: 0.20
Nodes (15): PDCA Workflow Board (Kanban, ADMIN view), Azure Resources (AKS, PostgreSQL, Key Vault), eam-prod Release (Clean Production Data), eam-staging Release (Demo Data), Helm Chart (Deploys the Application), ngrok Tunnel (Outbound Connection), Public HTTPS Live Demo URL, Terraform (Infrastructure as Code) (+7 more)

### Community 116 - "Golden Concepts"
Cohesion: 0.20
Nodes (11): Acceptance Scenarios & Reference Dataset (golden workflows as Given/When/Then), D-012 - le client est une société immobilière qui possède des biens, Competitive reality check and research questions, Phase 0 produit - traduction française, Golden workflow 1 - rental and maintenance loop, Golden workflow 2 - sale from listing to closing, Phase 0 decision - customer is a real-estate company that owns property (2026-10-09), Phase 0 Product Definition & Market Validation (+3 more)

### Community 124 - "Decision Concepts"
Cohesion: 0.24
Nodes (10): Cahier des Charges Général (v0.7), D-001 - SaaS multi-tenant avec isolation logique stricte, D-002 - no AI / ML module, D-008 - deux modèles de vendeur, un seul workflow, D-009 - vente de base dans le MVP, Use cases UC-001 to UC-018, Decision Log reference document (D-xxx), Modular monolith with explicit domain boundaries (+2 more)

### Community 125 - "Stitch Concepts"
Cohesion: 0.31
Nodes (10): 'Keep it simple, move fast to development' portfolio decision (2026-10-13), Gallery screens loop progress (Unites and Documents galleries), PAGES_PROGRESS - all 23 MVP pages created and verified, Emerald ERP design system (primary #047857, Inter, French UI), Gallery, viewer and empty-state Stitch screens (7 screens), Rotated Google API key committed in 9dd3724 (security incident), Stitch MCP lesson: edit_screens never saves in place, list_screens lags, failed calls create screens, Stitch design handoff document (+2 more)

### Community 133 - "Class Concepts"
Cohesion: 0.25
Nodes (9): Explicit AI / ML exclusion, D-007 - une même base métier pour location et vente, Diagrammes UML - version française (v1.2), Delete only if no leases and no payments; archive keeps history, UML Diagrams (v0.36, Mermaid, EN), MVP class model (74 classes across 10 groups), Rule-based matching of rent requests and prospects (simple rules, no AI), Syndic (shared building parts) handled by four buttons in existing areas (+1 more)

### Community 138 - "Ownership Concepts"
Cohesion: 0.25
Nodes (8): Step 0-10 document writing order, Conceptual Financial Model (planned consolidation document), Documentation problems 1-17 found in Phase 0 and Cahier 00, Business rule - ownership effective-dated when a leased unit is sold, Problem 11 - Tunisia payment reality, TND 3 decimals, Problem 17 - effective-dated ownership for sold-while-leased units, Problem 8 - owner remittances and management fees unspecified, Closing creates new Ownership (buyer becomes owner)

### Community 139 - "Client Concepts"
Cohesion: 0.25
Nodes (8): ownerships table — effective-dated share %, indivision, transfer, record_gaps view / fiches-incompletes page, Business rules live in the database (constraints, triggers, views), One self contact per organization (is_organization), Ownership attaches to units only; bien owners derived, Client accounts & ensure_client_contact (client_accounts, client role), Client writes via SECURITY DEFINER SQL functions (F6), Lessor shown on a lease = unit's current owner (D11)

### Community 140 - "Front Concepts"
Cohesion: 0.25
Nodes (8): Competing buyers ruling: 48h pending reservation, first confirmed wins (R1), Four delivery slices (move/listings, accounts/applications, offers/sales, client space), Migration numbering 0005–0009 (replaces leases-spec numbering), Override of D-010 'no renter/owner portal in MVP', Front office public site (vitrine), Task 11: front-office E2E + user handoff steps, Front office Slice 1 implementation plan (ERP move, public shell, listings), Tasks 7–10: listing card, home page, /louer & /acheter, /logement/[listingId]

### Community 144 - "Invoice Concepts"
Cohesion: 0.38
Nodes (7): Cahier 00 candidate states (Lease, Work Order, Sales Listing, Invoice), Contacts page replaces Proprietaires screens (one contact, several roles, glossary N-09), Glossary reference document (N-xxx naming rules), Phase 0 candidate state machines (vendor, work order, invoice statuses), Phase 1 exit test (global understanding from documents), Problem 12 - Invoice vs Vendor Bill collision and disagreeing state machines, State Machine Catalog (planned consolidation document)

### Community 145 - "Misc Community"
Cohesion: 0.48
Nodes (7): Cavecrew Builder (surgical 1-2 file edit agent), Cavecrew Investigator (read-only code locator agent), Cavecrew Reviewer (severity-tagged diff review agent), Cavecrew delegation skill (when to delegate), Caveman terse-voice skill, Caveman skill provenance (github.com/JuliusBrussee/caveman, Apache-2.0), Ultracave max-compression voice skill

### Community 149 - "Misc Community"
Cohesion: 0.29
Nodes (7): Plan Creation Form - Taches d'Execution (Planning & Equipes), Machine Detail - ML Intelligence Tab (sensor gauges, 8 neural models, Kalman/CUSUM, 73% fair score, 30-day survival), Machine Detail - Historique Tab (Historique des Interventions, 14 entries), Machine ML Metrics Panel - Failure Prob, 14-day RUL, Behavioral Anomaly Score, 24-Part 30-day Forecast, Admin Dashboard (Administration - Tableau de Bord) with KPI Cards and Donut Charts, Chef Technique Dashboard (Validation Hub) with Same KPI Layout, Technician Dashboard (/technician/dashboard) with AI Daily Briefing and Priority Actions

### Community 150 - "Misc Community"
Cohesion: 0.29
Nodes (7): Ordres de Travail Complétés Table with CT Feedback Column, Intervention Analytics Donut Charts (Status, Preventive vs Corrective, Root Cause, Critical Load), KPI Cards (49 Interventions, 4 Techniciens, 4 Machines, 4 Maintenance Prév. / 3 en retard), Chef Technique — Tableau de Bord (Technical Manager Dashboard), Briefing du Jour (AI-generated daily briefing with 'Pourquoi?' explainability), Actions Prioritaires (late-maintenance priority list: CMS1-L1-BRASSAGE, 2D_SCANNER, POSE), Tableau de Bord Technicien (Technician Dashboard)

### Community 151 - "Misc Community"
Cohesion: 0.38
Nodes (7): AppSync Load Test Script, CloudWatch Logs Audit Report, Kinesis Metrics Dashboard Pipeline, AWS Resource Inventory Harvest, Dev Data Seed Script, P6 Access Validation Suite, Local Postgres Docker Harness

### Community 154 - "Misc Community"
Cohesion: 0.29
Nodes (7): Toaster (sonner, RTL-aware), i18n locale config (fr/en/ar, NEXT_LOCALE cookie, LOCALE_SCRIPT), Arabic messages: appearance, Arabic messages: calendar, Arabic messages: common, Arabic messages: contacts, Arabic messages: dashboard

### Community 155 - "Misc Community"
Cohesion: 0.33
Nodes (6): Launch config: web dev server (npm --prefix web run dev, port 3000), CI Pipeline workflow (lint, type-check, unit tests, build, e2e, security scan, infra tests), CI E2E Tests job (LocalStack + Amplify deploy + web Docker image + Playwright), CI Infrastructure Tests job (infra/amplify-data npm test against LocalStack), CI Security Scan job (dependency review, CodeQL, npm audit), Deploy to Floci/LocalStack (develop branch + manual preview)

### Community 160 - "Misc Community"
Cohesion: 0.33
Nodes (6): GitLab CI/CD pipeline graph: scan-secrets → audit-backend/frontend, license-scan (sca-deps) → test-backend/frontend (test) → sonarqube-scan (sast) → build-images, lac-scan (build) → image-scan → push-yun-metrics → restart-scanner → dast-scan (dast) → lint-backend/frontend (lint) → quality-gate, GitLab job log — secret-scan (GITLEAKS Phase_2): 1 commit scanned, no leaks found, severity CRITICAL/HIGH/MEDIUM/LOW all 0, artifact gitleaks-report.json uploaded, job succeeded (project sagemcom-group/EAMHamZa), SonarQube Quality Gate PASSED — project EAMSagemCom (phase-2): 88k LoC, coverage 74.8% (required ≥70%), new issues 0, accepted issues 63, duplications 2.58% (≤3.0%), security hotspots 0, Grafana dashboard 'EAM — Container Security (Trivy)': 0 CRITICAL, 0 HIGH, 27 MEDIUM (87%), 4 LOW, 9 images scanned, 31 total CVEs; per-image CVEs 0 across eamsagemcom-backend/frontend/ml-microservice/rag-service images; vulnerability trend over time, Grafana dashboard 'EAM — DAST (OWASP ZAP)': 0 HIGH, 3 MEDIUM (27%), 4 LOW (36%), 4 UNKNOWN (36%), 4 INFORMATIONAL, 3 sites scanned, 11 total alerts; alert distribution and trend over time, SonarQube Quality Gate PASSED — project EAMSagemCom (phase-2), same metrics as p32 screenshot (74.8% coverage, 0 new issues, 2.58% duplications, 0 hotspots) — appears to be a duplicate figure

### Community 170 - "Backend Concepts"
Cohesion: 0.50
Nodes (5): Documentation Map (index of all project documents), Backend cutover to Floci; Nhost/Hasura kept as history, Docker dev / unit test / Playwright E2E workflow, Floci local AWS-compatible backend (AppSync, DynamoDB, S3, Cognito emulator), Real Estate Operations ERP (product and repo README)

### Community 173 - "Misc Community"
Cohesion: 0.50
Nodes (5): Machines Dashboard Screen (machine cards CMS1-L1-POSE/AOI/BRASSAGE with IA risk, health score /100, next maintenance, QR, import), Add New Machine Modal (auto-generated name CMS1-L1-2D_SCANNER, zone/sub-zone/order, maintenance dates, image URL), Work Order Management Screen (Gestion des Ordres de Travail: OT #313/#314 IN_PROGRESS/COMPLETED, closed OTs, chrono duration, Excel/PDCA export), Rule: approving an ITV automatically reserves the required stock, Intervention Request Approvals Screen (Approbations ITV: URGENTE/HAUTE/MOYENNE/BASSE requests to validate or reject)

### Community 174 - "Misc Community"
Cohesion: 0.50
Nodes (5): Groq LLM (generates the answer from retrieved context), MinIO (original files store), PostgreSQL + pgvector (chunks + vectors), RAG architecture diagram: USER → FastAPI BACKEND → RAG SERVICE → Postgres pgvector / MinIO / Groq LLM, RAG Service (ingest, embed, retrieve, rerank)

### Community 181 - "Misc Community"
Cohesion: 0.50
Nodes (4): check_docx_encoding.py (resume docx mojibake check), check_pdf_final.py (resume PDF content needles check), check_pdf_fr.py (FR resume page 2 peek), tail_notes.py (CV-notes md tail)

### Community 182 - "Misc Community"
Cohesion: 0.67
Nodes (4): Figure: Work Order (OT) Status State Machine Diagram, OT Lifecycle: DRAFT→SUBMITTED→APPROVED→ASSIGNED→IN_PROGRESS→COMPLETED→VALIDATED→CLOSED; APPROVED→REJECTED (releases stock), UI: Suivi des Ordres de Travail (CHEFTECH) — real-time OT monitoring table with ID, machine/intervention, technician, priority, status, dates, duration chrono, Excel report export, UI: 'Terminer l'OT #313' completion wizard (Technician) — 4 steps: Rapport, Diagnostic, Pièces & Outils, Télémétrie; fields: rapport final, type d'intervention, état de la machine après

### Community 183 - "Misc Community"
Cohesion: 0.50
Nodes (4): RAG Knowledge Base (32 docs, S3 bucket 'rag-docs', chunking, machine binding), S3 Sync / Bulk Import / Document Import Controls, Agentic Behavior (source citations 'db:alerts:2.txt', '5 database query results used'), Assistant IA Chat Interface (Powered by Groq LLM)

### Community 184 - "Misc Community"
Cohesion: 0.50
Nodes (4): CDK Template Patcher for Floci, Patch Function Unit Tests, Floci State Persistence Check, DynamoDB GSI Reconciler

### Community 185 - "Misc Community"
Cohesion: 0.67
Nodes (4): Tunis Medina Skyline Panorama Photo, African Development Bank (AfDB) Tunis Office Banner Photo, BVMT (Tunis Stock Exchange) Headquarters Photo, Emerald Immobilier Hero Illustration (code-drawn SVG)

### Community 188 - "Agency Concepts"
Cohesion: 0.67
Nodes (3): French-only indexing, en/ar client-side switch (R8), One agency per deployment, NEXT_PUBLIC_AGENCY_ORG_ID (F5/R7), Task 5: public data layer — parseSearchParams, searchListings, pickSimilar

### Community 189 - "Listings Concepts"
Cohesion: 1.00
Nodes (3): Listings publishing rules (check_listing_publishable, LISTING_* codes), public_listings view & unauthenticated `public` role, Task 2: migration 0005_listings.sql (listings table, triggers, public views)

### Community 190 - "Misc Community"
Cohesion: 1.00
Nodes (3): Login Screen 'Gestion des Actifs – Système de maintenance industrielle' with pending-approval error toast, Admin User Management Screen (roles CHETOP/CHEFTECH/TECHNICIEN, status APPROVED/PENDING, shift assignment, delete), Registration Request Approval Screen (Gestion des Demandes d'inscription – Approuver/Rejeter)

### Community 191 - "Daily Concepts"
Cohesion: 0.67
Nodes (3): Daily job + email Lambdas (lease-daily, notification/appointment e-mails), 7-day grace after lease end, then daily job expires it (D3), lease_rule(name) as single source of day thresholds (D10)

### Community 192 - "Misc Community"
Cohesion: 0.67
Nodes (3): Website publication blockers (unit_archived, property_archived, hidden, status, no_rent, no_sale_price, no_photo), Property & unit intake wizard (guided step flow; house/land get an auto-created unit; publication readiness step), Unit-card offline reason blockers (same key set as listings website blockers)

### Community 193 - "Misc Community"
Cohesion: 0.67
Nodes (3): Theme independent of business logic, no extra dependency (rationale), Theme system (one place owns the visual identity), Components never hard-code brand colours; use tokens (bg-primary, text-muted-foreground, var(--sidebar-panel))

### Community 194 - "Misc Community"
Cohesion: 0.67
Nodes (3): Next.js TypeScript plugin (next-env, .next types), TypeScript '@/*' path alias to ./src, Vitest resolve alias '@' -> ./src

### Community 195 - "Misc Community"
Cohesion: 0.67
Nodes (3): Coverage-guarded src/lib business logic and src/theme engine modules, Global 80% coverage thresholds (lines/functions/branches/statements), jsdom test environment with src/test/setup.ts

### Community 31 - "Password Reset Form"
Cohesion: 0.10
Nodes (38): Listing auto-close on lease activation (leased/unit_archived), contact_roles table (owner/renter/buyer, glossary N-09), contacts table (person/company), organizations table (multi-tenant root), create_self_contact() trigger (org owns its own stock via is_organization contact), ensure_owner_role() trigger (owning a unit grants contact role 'owner'), activate_lease() (draft->active: needs renter, unit, rent; logs initial term), assert_no_lease_overlap() (per-unit advisory locks, occupied-period overlap exclusion) (+30 more)

### Community 39 - "Auth Actions API"
Cohesion: 0.09
Nodes (31): Ownerships no-overlap constraint, Ownerships shares cap (deferred ≤100% check), Client identity from session (REQUEST_LOGIN_REQUIRED), properties table (biens: building/house/plot), public.set_updated_at() trigger function (shared updated_at maintenance), units table (apartment/office/shop/parking, status, rent_amount), check_ownership_shares() deferred trigger (advisory lock per unit, total share <= 100%), common_areas table (syndic shared parts of a building) (+23 more)

### Community 44 - "Misc Utilities"
Cohesion: 0.08
Nodes (29): Add a palette: append PALETTES entry in palettes.ts, Add a new themed token: default in globals.css, emit in generate.ts build, use var(), /erp/administration/apparence — palette picker, live preview with Apply/Cancel, restore defaults, saved palettes, Change default theme: globals.css blocks + eam-green seed; isDefaultSelection gate, Chart hues 2–5 categorical, moved away from primary hue, color.ts — hex <-> OKLCH, WCAG contrast, eam-green seed — swatches base of custom colours, <style id="erp-theme"> html:root / html.dark outranks defaults (+21 more)

### Community 45 - "Misc Utilities"
Cohesion: 0.09
Nodes (28): Visit payment settings: method virtual/manual/none, remote-payment instructions shown to confirmed visitors, English labels module (mirrors fr/labels via typeof fr; adds English glosses for DB codes), Lease lifecycle concept: draft → active → ended/expired, grace week, renewal, end reasons, unit freeing, English leases module (mirrors fr/leases via typeof fr), Lease registration workflow: tax-office registration date + receipt number, deadline relative to signing date, overdue/grace countdown, Unit website publication rules: online as soon as shown, free/for-sale, priced, and photographed; explicit blocker reasons, English navigation module (mirrors fr/nav): nav groups steering/management/analysis/administration, item labels, breadcrumbs, Notification kinds: lease_ending_soon, lease_grace, lease_expired, registration_due, registration_overdue, appointment_reminder, rental_request, visit_request (+20 more)

### Community 56 - "Playwright E2E Tests"
Cohesion: 0.10
Nodes (26): Survival Cox PH (time-to-failure hazard model), CUSUM + Kalman (drift anomaly, smoothed), DST Fusion — Dempster-Shafer (combines 4 BPAs, Yager's rule if conflict K > 0.8), Mahalanobis Health Index (multivariate distance), PINN RUL (physics-informed estimator), Telemetry history — per-machine time series, unified_health_score (0.7×DST + 0.3×Kalman HI + dst_verdict), Reminder/survival C-index chart (naive 0.644 vs Cox PH 0.712 vs Weibull AFT 0.714) (+18 more)

### Community 71 - "Misc Utilities"
Cohesion: 0.12
Nodes (22): fr as type-checked master dictionary (typeof fr contract), Server constraint code → user message catalog (lease_*, appointment_*, sharesExceeded, ownershipOverlap, unitCodeTaken, leaseOverlap), Common-area shares (unit shares in ‰, total must be 1000, suggest-from-areas by surface), Arabic locale bundle (ar) — composition of 19 domain dictionaries, Shared domain enumerations (property types, unit types, unit statuses, area kinds, contact roles, Tunisian governorates), Lease registration deadline (registered at Tunisian tax office, receipt number, overdue flag, date ≥ signing date), Lease status lifecycle (draft → active → ended/expired) with end reasons and renewal/ended tabs, Notification kinds (lease_ending_soon, lease_grace, lease_expired, registration_due/overdue, appointment_reminder, rental_request, visit_request) (+14 more)

### Community 74 - "ERP Page Catalog"
Cohesion: 0.13
Nodes (21): Rental Requests Board (/erp/baux/demandes), Rental Requests Page Tests, Leases List (/erp/baux), New Lease Page (/erp/baux/nouveau), Archived Properties Page, Properties Map Page, Property Detail Page, Edit Property Page (+13 more)

### Community 80 - "Misc Utilities"
Cohesion: 0.12
Nodes (17): Archive screen — Asset Management app (248 archived items, auto-purge after 30 days, tabs: Tâches Planning / Ordres Travail / Interventions / Plannings(49), Lancer sweep, Réactiver), Main sidebar navigation: Admin Dashboard, Planning, Utilisateurs, Approbations Users, Approbations ITV, Gestion des OT, Machines, Stocks/Pièces, File pièces non-cat., ML & Prédictions, Dashboard IA Flotte, IoT Dashboard, Alertes Prédictives, Assistant IA, Report figure — maintenance intervention workflow: Planning-assigned or Ad hoc observation → Intervention request (PENDING) → CHEFTECH validation → Approved (work order created) / Rejected (DECLINED, stock reservations released) → Work order (assigned → in progress → completed) → Final CHEFTECH validation (diagnosis required, VALIDATED) → Closed by ADMIN (CLOSED), Report figure — predictive pipeline: Machine telemetry (5 sensors, continuous) → ML engine with two parallel pipelines (P1–P7 predictions ∥ DST-fused health score) → Readiness score & alerts (including parts shortages) → Purchase draft (requires human validation), Class Archive: identifiantArchive, nom, dateArchivage, type; ajouterDocument(), obtenirDocumentsArchivés(), Class MaintenancePlanifiee (planned by Utilisateur), Class Ordre: identifiant, titre, description, dateCreation, statut; mettreÀJourStatut(Statut), Class OrdreIntervention (extends Ordre): dateIntervention, rapport (+9 more)

### Community 85 - "Misc Utilities"
Cohesion: 0.15
Nodes (17): Scheduler — Celery beat, daily, ConsumedPiece — completion record of parts actually used, create_deficit_alert() — raised after InsufficientStockError, invalidates ML forecast cache, fulfill_reservation() — technician confirms parts used; records actual usage, adjusts stock; piece auto-linked to machine (best-effort, non-fatal), InsufficientStockError — rolled back, nothing reserved, MouvementStock — audit trail for every reservation/release/consumption process, release_all() — clears the reservation and logs the release when an intervention/work order is rejected, release_expired() — releases reservations past the 7-day TTL (+9 more)

### Community 86 - "Misc Utilities"
Cohesion: 0.14
Nodes (17): AI Analysis Orchestration (9 neural models + Kalman filter temporal smoothing), Behavioral Anomaly Panel (Ensemble Score, Mahalanobis Distance, NORMAL status), Unified Health Score 68 (DST-fused across 8 active models), IoT Sensor Metrics (Air Temp, Process Temp, Rotation RPM, Torque, Tool Wear), Machine Detail — ML Intelligence Tab (Neural Engine, 8 Models Active), 30-Day Survival 68% / RUL Estimate 16 Days / Schedule 4 Days, Tableau de Bord IA — Flotte (AI Fleet Health Dashboard), Per-Machine Health Cards (Santé 67–79/100, RUL 15–16j, Fiabilité 25–26) (+9 more)

### Community 90 - "Spec Decisions Matrix"
Cohesion: 0.18
Nodes (16): Authorization Matrix (role x action x scope consolidation), Cahier 00 actor x domain orientation matrix (§16), D-010 - MVP réservé aux utilisateurs internes, D-011 - départements et rôles définis par chaque organisation, Cahier des Charges 01 - Organisation & Accès (v0.6), Acceptance criteria 1-13 (tenant isolation and access tests), Department tree and scoping (Tunis Nord example), Five model roles (Administrateur, Gestionnaire, Commercial, Finance, Technicien) (+8 more)

## Ambiguous Edges - Review These
- `CloudWatch Logs audit + error triage (4094 events; bursts = negative tests, warm containers)` → `Unreadable file infra/amplify-data/log-signatures.txt (binary)`  [AMBIGUOUS]
  infra/amplify-data/log-signatures.txt · relation: conceptually_related_to
- `Launch config: web dev server (npm --prefix web run dev, port 3000)` → `CI E2E Tests job (LocalStack + Amplify deploy + web Docker image + Playwright)`  [AMBIGUOUS]
  .claude/launch.json · relation: conceptually_related_to
- `Later: intervention completed → root-cause diagnosis → CHEFTECH revalidates → VALIDATED (PDCA)` → `CHEFTECH UI screenshot: 'Demandes d'Intervention en Attente' list (48 requests, VALIDATED/TERMINÉ badges, Seed cycle 11/12 preventive checks)`  [AMBIGUOUS]
  infra/amplify-data/metrics/pfe-img/p65_Im36.png · relation: references

## Knowledge Gaps
- **255 isolated node(s):** `MSYS_NO_PATHCONV`, `PATH`, `API first (every screen uses the same REST API)`, `Tunisian personal-data protection law (Loi organique 2004-63 / INPDP)`, `Open questions (seasonal rentals, taxes/e-invoicing, WhatsApp, sale payment path)` (+250 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1304 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **79 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Lease Draft Editing` to `Booking & Public UI Tests`, `Leases & Properties Lists`, `Public Home Hero & Filters`, `Lease-Contact Components`, `Lease Draft Editing`, `Maps & Incomplete Records`, `Theme & Fonts Setup`, `Calendar & UI Libraries`, `App Sidebar & Navigation`, `Maps & Incomplete Records`, `Storage S3 API Routes`, `Maps & Incomplete Records`, `Public Listing Pages`, `Requests & Visits Pages`, `Unit Dialog Form`, `Listing Details UI`, `App Header & Breadcrumb`, `Contact Form`, `Public Listing Pages`, `Leaflet Maps`, `Calendar Toolbar & Dates`, `Appointment Details & Editor`, `Theme Icons & Palette`, `Appointment Sheet UI`, `Theme Icons & Palette`, `Unit Filtering`, `Visitor Requests Backend`, `Calendar Page`, `App Layout & Motion`, `Placeholder Pages`, `ERP Auth Pages & Config`, `Visit Booking Forms`, `Favorites & Charts`, `Appointment List UI`, `Public Buy/Rent Pages`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `useGraphql` (e.g. with `assertWritable` and `useAppearance`) actually correct?**
  _`useGraphql` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `MSYS_NO_PATHCONV`, `PATH`, `API first (every screen uses the same REST API)` to the rest of the system?**
  _255 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Appearance Settings UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05293668954996186 - nodes in this community are weakly interconnected._
- **Why does `notificationMail() French notification mail` connect `Misc Utilities` to `Mail Events & Change Records`, `Auth Actions API`, `Password Reset Form`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `CloudWatch Logs audit + error triage (4094 events; bursts = negative tests, warm containers)` and `Unreadable file infra/amplify-data/log-signatures.txt (binary)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Launch config: web dev server (npm --prefix web run dev, port 3000)` and `CI E2E Tests job (LocalStack + Amplify deploy + web Docker image + Playwright)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._