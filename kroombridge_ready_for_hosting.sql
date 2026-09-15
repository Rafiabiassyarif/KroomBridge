-- MySQL dump 10.13  Distrib 8.4.3, for Win64 (x86_64)
--
-- Host: localhost    Database: kroombridge
-- ------------------------------------------------------
-- Server version	8.4.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'Admin',
  `password` varchar(255) NOT NULL,
  `createdAt` varchar(50) DEFAULT NULL,
  `lastLogin` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admins_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES ('admin_e058d0fa','Admin2','admin2@kroombox.id','Admin','$2b$10$T/MfCjU7VDmvob.xgy96QupyDPGzLpeQ.GeoPhYKKEAPS1jokTIya','2026-06-17T08:24:43.329Z','2026-09-15T09:12:30.057Z'),('admin_sys','Admin','admin@kroombox.id','Admin','$2b$10$KhIDSUZnewpaQ6UCNPjNsu3ZqkvEeZ/RTXgE69QvWz3gBRGfJQ6te','2026-05-03T13:00:00.000Z','2026-09-15T08:05:45.987Z');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `packageId` varchar(50) NOT NULL,
  `secretKey` varchar(255) NOT NULL,
  `keyVersion` int NOT NULL DEFAULT '1',
  `usageThisMonth` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `quotaAlertSent` tinyint(1) DEFAULT '0',
  `customQuota` int DEFAULT NULL,
  `createdAt` varchar(50) DEFAULT NULL,
  `lastSeen` varchar(50) DEFAULT NULL,
  `lastReset` varchar(50) DEFAULT NULL,
  `lastAnnualQuotaReset` varchar(50) DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_clients_secretKey` (`secretKey`),
  KEY `fk_clients_package` (`packageId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
INSERT INTO `clients` VALUES ('a1','sys_admin','admin@kolabpanel.com','active','pkg_pro','sk_a1_326f1u8c',1,0,1,0,NULL,'2026-07-08T04:50:34.004Z','2026-07-09T07:37:18.387Z',NULL,NULL,'[\"umum\", \"ADMIN\"]','Synced from Kroombox Panel. Plan: Webmaster Elite'),('client_40606af0298b','andi',NULL,'active','pkg_starter','sk_b878621d573c42bfbbe66f4c8174de63',1,0,1,0,NULL,'2026-07-08T02:14:25.091Z','2026-07-15T04:24:53.919Z',NULL,NULL,'[]',''),('u_1785999514365','user_naugan','akun@naungan.com','active','pkg_pro','sk_u_1785999514365_y99zgxa0',1,0,1,0,NULL,'2026-08-16T14:20:46.279Z',NULL,NULL,NULL,'[\"umum\", \"USER\"]','Synced from Kroombox Panel. Plan: Dedicated JS Stack'),('u_1786350269437','salman','salman@jagoai.edu','active','pkg_starter','sk_u_1786350269437_hs69fe07',1,0,1,0,NULL,'2026-08-11T07:17:38.557Z',NULL,NULL,NULL,'[\"umum\", \"USER\"]','Synced from Kroombox Panel. Plan: Minibox Edge Lab'),('u_mr73ezqk_83ur6j','Nouvem','n00uxx1@proton.me','active','pkg_basic','sk_u_mr73ezqk_83ur6j_z02lrwi3',1,10737,1,0,NULL,'2026-07-08T04:50:34.007Z','2026-07-15T06:53:08.864Z',NULL,NULL,'[\"umum\", \"USER\"]','Synced from Kroombox Panel. Plan: Basic'),('u_mr8zf18k_6rlic6','apriladzani','april.adzania@gmail.com','active','pkg_pro','sk_u_mr8zf18k_6rlic6_2z573vxn',1,0,1,0,NULL,'2026-07-08T04:50:34.007Z','2026-07-15T04:24:43.779Z',NULL,NULL,'[\"umum\", \"USER\"]','Synced from Kroombox Panel. Plan: Dedicated JS Stack'),('u_mra3f1i5_h4f83n','Andi Ahmad Nurmadani','andiahmadnurmadani15@gmail.com','active','pkg_starter','sk_u_mra3f1i5_h4f83n_bbkxp6rj',1,0,1,0,NULL,'2026-07-08T04:50:34.009Z','2026-07-15T04:19:13.059Z',NULL,NULL,'[\"mahasiswa\", \"USER\"]','Synced from Kroombox Panel. Plan: Minibox Edge Lab'),('u_mrelfj3e_3l865q','Arif','zeto5102@gmail.com','active','pkg_starter','sk_u_mrelfj3e_3l865q_f4slslyd',1,0,1,0,NULL,'2026-07-16T02:48:32.541Z',NULL,NULL,NULL,'[\"umum\", \"USER\"]','Synced from Kroombox Panel. Plan: Minibox Edge Lab'),('u_mrvridb0_l7rnc1','budi','lidimah996@luckfeed.com','active','pkg_basic','sk_u_mrvridb0_l7rnc1_6fy4yp8v',1,0,1,0,NULL,'2026-07-27T02:18:52.899Z',NULL,NULL,NULL,'[\"mahasiswa\", \"USER\"]','Synced from Kroombox Panel. Plan: Basic'),('u_mrvryaao_gzbvjq','faisal','rahmanfaisal653@gmail.com','active','pkg_pro','sk_u_mrvryaao_gzbvjq_pkk8d2ne',1,0,1,0,NULL,'2026-07-27T02:23:09.285Z',NULL,NULL,NULL,'[\"mahasiswa\", \"USER\"]','Synced from Kroombox Panel. Plan: Creator Pro'),('u_mrx005hi_5vz4su','Alya Permata','fajrialyaya78@gmail.com','active','pkg_basic','sk_u_mrx005hi_5vz4su_i89l9dwd',1,0,1,0,NULL,'2026-07-27T02:18:52.903Z',NULL,NULL,NULL,'[\"umum\", \"USER\"]','Synced from Kroombox Panel. Plan: Basic'),('u_ms2lt4if_3137ux','Tazkya Mutia Ramadhan','tazkyamr34@gmail.com','active','pkg_basic','sk_u_ms2lt4if_3137ux_iyuomesx',1,0,1,0,NULL,'2026-07-28T04:02:18.293Z',NULL,NULL,NULL,'[\"mahasiswa\", \"USER\"]','Synced from Kroombox Panel. Plan: Basic'),('u_ms3zmnn7_6hpkv7','digidaw','digidaw@sigmaku.biz.id','active','pkg_starter','sk_u_ms3zmnn7_6hpkv7_lusjsl66',1,0,1,0,NULL,'2026-07-28T04:02:18.293Z',NULL,NULL,NULL,'[\"umum\", \"USER\"]','Synced from Kroombox Panel. Plan: Minibox Edge Lab'),('u_ms4g7h61_i2rwyu','WICIPTO SETIADI','wiciptosetiadi99@gmail.com','active','pkg_basic','sk_u_ms4g7h61_i2rwyu_4zniekbs',1,0,1,0,NULL,'2026-08-11T07:17:38.561Z',NULL,NULL,NULL,'[\"mahasiswa\", \"USER\"]','Synced from Kroombox Panel. Plan: Basic'),('u1',' <script>alert(\'XSS\')</script>','user@example.com','active','pkg_starter','sk_u1_cpvjvkor',1,0,1,0,NULL,'2026-07-08T04:50:34.010Z',NULL,NULL,NULL,'[\"umum\", \"USER\"]','Synced from Kroombox Panel. Plan: Minibox Edge Lab');
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `logs`
--

DROP TABLE IF EXISTS `logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `logs` (
  `id` varchar(100) NOT NULL,
  `timestamp` varchar(50) NOT NULL,
  `clientId` varchar(50) DEFAULT NULL,
  `clientName` varchar(100) DEFAULT NULL,
  `routeId` varchar(50) DEFAULT NULL,
  `method` varchar(20) NOT NULL,
  `path` varchar(500) NOT NULL,
  `statusCode` int NOT NULL,
  `durationMs` int NOT NULL DEFAULT '0',
  `ipAddress` varchar(100) DEFAULT NULL,
  `userAgent` text,
  `error` text,
  PRIMARY KEY (`id`),
  KEY `idx_logs_clientId` (`clientId`),
  KEY `idx_logs_routeId` (`routeId`),
  KEY `idx_logs_timestamp` (`timestamp`),
  KEY `idx_logs_statusCode` (`statusCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `logs`
--

LOCK TABLES `logs` WRITE;
/*!40000 ALTER TABLE `logs` DISABLE KEYS */;
INSERT INTO `logs` VALUES ('log_1789369197568','2026-09-14T06:59:57.568Z','u_mr73ezqk_83ur6j','Nouvem','route_1785117779611_h3lw5xn','POST','/gateway/kroma/v1/chat/completions',200,7509,'127.0.0.1','OpenAI/Python 2.24.0',NULL),('log_1789369235368','2026-09-14T07:00:35.368Z','u_mr73ezqk_83ur6j','Nouvem','route_1785117779611_h3lw5xn','POST','/gateway/kroma/v1/chat/completions',200,7781,'127.0.0.1','OpenAI/Python 2.24.0',NULL),('log_1789369259024','2026-09-14T07:00:59.024Z','u_mr73ezqk_83ur6j','Nouvem','route_1785117779611_h3lw5xn','POST','/gateway/kroma/v1/chat/completions',200,7376,'127.0.0.1','OpenAI/Python 2.24.0',NULL),('log_1789369268350','2026-09-14T07:01:08.350Z','u_mr73ezqk_83ur6j','Nouvem','route_1783476456833_5z37iqb','GET','/gateway/kroma/v1/props',404,128,'127.0.0.1','python-httpx/0.28.1',NULL),('log_1789369270696','2026-09-14T07:01:10.696Z','u_mr73ezqk_83ur6j','Nouvem','route_1783476456833_5z37iqb','GET','/gateway/kroma/v1/props',404,90,'127.0.0.1','python-httpx/0.28.1',NULL),('log_1789369270801','2026-09-14T07:01:10.801Z','u_mr73ezqk_83ur6j','Nouvem','route_1785117779611_tdc8lao','GET','/gateway/kroma/v1/models/Fable%205',404,83,'127.0.0.1','python-httpx/0.28.1',NULL),('log_1789369270930','2026-09-14T07:01:10.930Z','u_mr73ezqk_83ur6j','Nouvem','route_1783476456833_5z37iqb','GET','/gateway/kroma/v1/props',404,90,'127.0.0.1','python-httpx/0.28.1',NULL),('log_1789369280682','2026-09-14T07:01:20.682Z','u_mr73ezqk_83ur6j','Nouvem','route_1785117779611_h3lw5xn','POST','/gateway/kroma/v1/chat/completions',200,7317,'127.0.0.1','OpenAI/Python 2.24.0',NULL),('log_1789369716910','2026-09-14T07:08:36.910Z','u_mr73ezqk_83ur6j','Nouvem','route_1785117779611_h3lw5xn','POST','/gateway/kroma/v1/chat/completions',200,7654,'127.0.0.1','OpenAI/Python 2.24.0',NULL),('log_1789369729495','2026-09-14T07:08:49.495Z','u_mr73ezqk_83ur6j','Nouvem','route_1783476456833_5z37iqb','GET','/gateway/kroma/v1/props',404,146,'127.0.0.1','python-httpx/0.28.1',NULL),('log_1789370298347','2026-09-14T07:18:18.347Z','u_mr73ezqk_83ur6j','Nouvem','route_1785117779611_h3lw5xn','POST','/gateway/kroma/v1/chat/completions',403,0,'127.0.0.1','OpenAI/Python 2.24.0','Model \'Fable 5\' sedang dinonaktifkan'),('log_1789370300530','2026-09-14T07:18:20.530Z','u_mr73ezqk_83ur6j','Nouvem','route_1785117779611_h3lw5xn','POST','/gateway/kroma/v1/chat/completions',403,0,'127.0.0.1','OpenAI/Python 2.24.0','Model \'Fable 5\' sedang dinonaktifkan');
/*!40000 ALTER TABLE `logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `packages`
--

DROP TABLE IF EXISTS `packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `packages` (
  `id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `monthlyQuota` int NOT NULL DEFAULT '0',
  `maxRequestsPerMinute` int NOT NULL DEFAULT '60',
  `quotaType` varchar(50) NOT NULL DEFAULT 'request',
  `allowOverage` tinyint(1) NOT NULL DEFAULT '0',
  `overageRatePer1K` float NOT NULL DEFAULT '0',
  `allowedEndpoints` json DEFAULT NULL,
  `price` int DEFAULT NULL,
  `createdAt` varchar(50) DEFAULT NULL,
  `allowedModels` json DEFAULT NULL,
  `costPerRequest` int NOT NULL DEFAULT '1',
  `costPer1KTokens` int NOT NULL DEFAULT '20',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `packages`
--

LOCK TABLES `packages` WRITE;
/*!40000 ALTER TABLE `packages` DISABLE KEYS */;
INSERT INTO `packages` VALUES ('pkg_basic','Basic','Paket Basic - Saldo AI Rp 50.000 untuk penggunaan personal & project kecil',65000,100,'credit',0,0,'[\"*\"]',65000,'2026-09-15T02:52:22.163Z','[\"*\"]',1,20),('pkg_business','Business','Paket Business - Saldo AI Rp 250.000 untuk tim dan aplikasi produksi',300000,300,'credit',0,0,'[\"*\"]',300000,'2026-09-15T02:52:22.163Z','[\"*\"]',1,20),('pkg_enterprise','Enterprise','Paket Enterprise - Saldo AI Rp 500.000 untuk volume tinggi dan integrasi skala besar',600000,500,'credit',0,0,'[\"*\"]',600000,'2026-09-11T03:06:23.014Z','[\"*\"]',1,20),('pkg_free','Free','Akses uji coba gratis dengan saldo awal Rp 5.000 untuk semua model AI.',5000,30,'credit',0,0,'[\"*\"]',0,'2026-09-11T04:00:26.800Z','[\"*\"]',1,20),('pkg_pro','Pro','Paket Pro - Saldo AI Rp 100.000 untuk developer & freelancer aktif',125000,150,'credit',0,0,'[\"*\"]',125000,'2026-09-11T03:16:22.799Z','[\"*\"]',1,20),('pkg_starter','Starter','Paket Starter - Saldo AI Rp 25.000 untuk kebutuhan awal dan testing',35000,60,'credit',0,0,'[\"*\"]',35000,'2026-09-11T03:06:23.013Z','[\"*\"]',1,20);
/*!40000 ALTER TABLE `packages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `routes`
--

DROP TABLE IF EXISTS `routes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `routes` (
  `id` varchar(50) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `path` varchar(255) NOT NULL,
  `upstreamUrl` varchar(500) NOT NULL,
  `description` text,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `method` varchar(20) NOT NULL DEFAULT 'ALL',
  `timeout` int DEFAULT NULL,
  `headers` json DEFAULT NULL,
  `transformations` json DEFAULT NULL,
  `createdAt` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_routes_path` (`path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `routes`
--

LOCK TABLES `routes` WRITE;
/*!40000 ALTER TABLE `routes` DISABLE KEYS */;
INSERT INTO `routes` VALUES ('route_1783476456833_5z37iqb',NULL,'/gateway/kroma/v1','https://kroma.kroombox.com/v1','Model Kroma AI: qwen3.6-27b (text-to-text) - Qwen best model so far and stable',1,'ALL',NULL,'{\"x-api-key\": \"kg_f2cdc203588a4b98f8c0014c35540322760b4e10759b201b\"}','{}','2026-07-08T02:07:36.833Z'),('route_1785117779611_h3lw5xn',NULL,'/gateway/kroma/v1/chat/completions','https://9r.kii.lat/v1/chat/completions','Kroma AI Chat Completions',1,'ALL',NULL,'{\"Authorization\": \"Bearer sk-3701dcba805391ae-ngmi9r-1c0dcc48\"}','{}','2026-07-27T02:02:59.611Z'),('route_1785117779611_tdc8lao',NULL,'/gateway/kroma/v1/models','https://9r.kii.lat/v1/models','Kroma AI Models',1,'ALL',NULL,'{\"Authorization\": \"Bearer sk-3701dcba805391ae-ngmi9r-1c0dcc48\"}','{}','2026-07-27T02:02:59.611Z');
/*!40000 ALTER TABLE `routes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` json DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES ('meta','{\"apiKeys\": [{\"id\": \"80b0046f-b915-403d-ae94-74c72a8848c5\", \"key\": \"kg_f2cdc203588a4b98f8c0014c35540322760b4e10759b201b\", \"name\": \"KromaBridge\", \"provider\": \"kroma\", \"createdAt\": \"2026-07-13T08:42:40.685Z\"}], \"version\": \"1.0.0\", \"kromaApiKey\": \"kg_ac0514c8a36f7f10bca54f7f5eee259b7dd5c1480461f40a\", \"modelAliases\": {\"oc/mimo-v2.5\": \"Fable 5\"}, \"quotaResetDay\": 2, \"disabledModels\": [\"oc/mimo-v2.5\"], \"lastQuotaReset\": \"2026-09\", \"quotaResetMode\": \"monthly\", \"quotaResetMonth\": 6, \"lastAnnualQuotaReset\": \"2026\"}'),('security','{\"ipDenylist\": [], \"ipAllowlist\": [], \"requireHttps\": false, \"maxBodySizeKb\": 512, \"upstreamValidationShield\": true, \"rateLimitAnomalyDetection\": true}');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-15 22:17:25
