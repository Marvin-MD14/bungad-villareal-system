-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Oct 10, 2026
-- Server version: 11.8.9-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u564212519_geogad`
--

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `audit_logs` (`id`, `user_id`, `action`, `description`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, 1, 'Login', 'User logged in successfully', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', '2026-08-13 07:49:45'),
(2, 1, 'Logout', 'User logged out', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', '2026-08-13 08:33:59'),
(3, 2, 'Login', 'User logged in successfully', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', '2026-08-13 08:34:06'),
(4, 1, 'Login', 'User logged in successfully', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', '2026-08-23 03:33:27'),
(5, 1, 'Add Official', 'Added official: Kai', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', '2026-08-23 06:07:01'),
(6, 1, 'Add Official', 'Added official: toni', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', '2026-08-23 06:17:15'),
(7, 1, 'Login', 'User logged in successfully', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36', '2026-09-27 05:58:40'),
(8, 2, 'Login', 'User logged in successfully', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36', '2026-09-27 09:17:29'),
(9, 1, 'Login', 'User logged in successfully', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-10 00:27:42'),
(10, 2, 'Login', 'User logged in successfully', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-10 00:44:52');

-- --------------------------------------------------------

--
-- Table structure for table `barangays`
--

DROP TABLE IF EXISTS `barangays`;
CREATE TABLE `barangays` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `population` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `barangays` (`id`, `name`, `description`, `latitude`, `longitude`, `population`, `is_active`, `created_at`) VALUES
(1, 'Lictin', 'Barangay Lictin - San Andres, Catanduanes', 13.60200000, 124.12780000, 2158, 1, '2026-08-13 07:31:06'),
(2, 'San Jose', 'Barangay San Jose - San Andres, Catanduanes', 13.59390000, 124.15040000, 492, 1, '2026-08-13 07:31:06'),
(3, 'Palawig', 'Barangay Palawig - San Andres, Catanduanes (coastal)', 13.57220000, 124.14140000, 1298, 1, '2026-08-13 07:31:06'),
(4, 'Rizal', 'Barangay Rizal - San Andres, Catanduanes', 13.59980000, 124.14670000, 886, 1, '2026-08-13 07:31:06'),
(5, 'Timabaan', 'Barangay Timabaan - San Andres, Catanduanes', 13.60370000, 124.11660000, 1633, 1, '2026-08-13 07:31:06');

-- --------------------------------------------------------

--
-- Table structure for table `complainants`
--

DROP TABLE IF EXISTS `complainants`;
CREATE TABLE `complainants` (
  `id` int(11) NOT NULL,
  `incident_id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `age` int(11) DEFAULT NULL,
  `gender` enum('Male','Female','Other') DEFAULT NULL,
  `address` text DEFAULT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `relationship_to_incident` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `complainants` (`id`, `incident_id`, `full_name`, `age`, `gender`, `address`, `contact_number`, `relationship_to_incident`, `created_at`) VALUES
(1, 6, 'Maria Lopez', 34, 'Female', 'Purok 1, Palawig', '09171234567', 'Victim', '2026-02-21 14:50:00'),
(2, 10, 'Ana Reyes', 28, 'Female', 'Purok 2, Lictin', '09182345678', 'Victim', '2026-04-06 20:05:00'),
(3, 18, 'Carla Santos', 22, 'Female', 'San Jose Poblacion', '09193456789', 'Victim', '2026-02-06 12:35:00'),
(4, 25, 'Rosa Dela Cruz', 41, 'Female', 'Lictin Barangay Hall', '09204567890', 'Victim', '2026-03-21 18:20:00'),
(5, 34, 'Jenny Cruz', 26, 'Female', 'Palawig Barangay Hall', '09215678901', 'Victim', '2026-02-10 09:35:00'),
(6, 45, 'Liza Mercado', 30, 'Female', 'Rizal Health Station', '09226789012', 'Victim', '2026-04-12 09:05:00'),
(7, 50, 'Grace Bautista', 38, 'Female', 'San Jose Covered Court', '09237890123', 'Victim', '2026-04-23 14:50:00'),
(8, 53, 'Elena Torres', 33, 'Female', 'Lictin Health Center', '09248901234', 'Victim', '2026-07-25 13:50:00');

-- --------------------------------------------------------

--
-- Table structure for table `gad_incidents`
--

DROP TABLE IF EXISTS `gad_incidents`;
CREATE TABLE `gad_incidents` (
  `id` int(11) NOT NULL,
  `incident_number` varchar(20) NOT NULL,
  `incident_type_id` int(11) DEFAULT NULL,
  `barangay_id` int(11) NOT NULL,
  `incident_date` date NOT NULL,
  `incident_time` time NOT NULL,
  `location` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `reported_by` int(11) NOT NULL,
  `status` enum('pending','validated','resolved','closed') DEFAULT 'pending',
  `priority` enum('low','medium','high','critical') DEFAULT 'medium',
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `complainant_id` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `validation_notes` text DEFAULT NULL,
  `severity_score` int(11) DEFAULT 1,
  `applied_bpo` tinyint(1) DEFAULT 0,
  `referred_to` varchar(100) DEFAULT NULL,
  `case_disposition` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- 30 incident records
--

INSERT INTO `gad_incidents` (`id`, `incident_number`, `incident_type_id`, `barangay_id`, `incident_date`, `incident_time`, `location`, `description`, `reported_by`, `status`, `priority`, `latitude`, `longitude`, `created_at`, `updated_at`, `complainant_id`, `assigned_to`, `resolved_at`, `validation_notes`, `severity_score`, `applied_bpo`, `referred_to`, `case_disposition`) VALUES
(1,  'GAD-20260101-001', 1,  1, '2026-01-01', '14:30:00', 'Lictin Barangay Hall',    'Reported case of gender-based violence involving a married couple. Victim sustained minor injuries and was referred to the Barangay VAW Desk.', 2, 'validated', 'high',     13.82220000, 124.29060000, '2026-01-01 14:35:00', '2026-01-02 09:00:00', NULL, NULL, NULL, 'Verified with barangay blotter and confirmed by complainant.', 6, 0, NULL, NULL),
(2,  'GAD-20260102-002', 2,  2, '2026-01-02', '10:00:00', 'San Jose Poblacion',       'Domestic violence incident reported by a concerned neighbor. Barangay tanod responded within 15 minutes and separated the parties.', 3, 'resolved',  'critical', 13.96550000, 124.42190000, '2026-01-02 10:05:00', '2026-01-10 15:30:00', NULL, NULL, '2026-01-10 15:30:00', 'Case resolved after mediation. Parties agreed to counseling.', 8, 1, 'Barangay VAW Desk', 'Settled amicably through mediation.'),
(3,  'GAD-20260103-003', 3,  3, '2026-01-03', '15:30:00', 'Palawig Market',           'Sexual harassment complaint filed by a female vendor against a co-worker. Formal statement taken at the Barangay Hall.', 4, 'validated', 'high',     14.05330000, 124.50270000, '2026-01-03 15:40:00', '2026-01-05 10:00:00', NULL, NULL, NULL, 'Complaint verified and endorsed to PNP Women and Children Protection Desk.', 6, 0, 'PNP WCPD', NULL),
(4,  'GAD-20260104-004', 4,  4, '2026-01-04', '09:00:00', 'Rizal Elementary School',  'Discrimination complaint filed by a parent regarding unfair treatment of a child based on gender. School administration was notified.', 5, 'resolved',  'medium',   13.80000000, 124.27040000, '2026-01-04 09:05:00', '2026-01-12 14:00:00', NULL, NULL, '2026-01-12 14:00:00', 'Resolved after a dialogue between the school and the complainant.', 4, 0, NULL, 'Closed after issuing formal apology and orientation.'),
(5,  'GAD-20260105-005', 1,  5, '2026-01-05', '11:30:00', 'Timabaan Fishing Port',    'Gender-based violence reported involving a fisherman and his partner. Barangay Health Worker provided first aid.', 6, 'pending',   'high',     13.88880000, 124.35120000, '2026-01-05 11:35:00', '2026-01-05 11:35:00', NULL, NULL, NULL, NULL, 6, 0, NULL, NULL),
(6,  'GAD-20260221-001', 6,  3, '2026-02-21', '14:45:00', 'Palawig Barangay Hall',    'Psychological abuse case involving repeated verbal threats and humiliation by a partner.', 4, 'validated', 'low',      13.57773766, 124.13487678, '2026-02-21 14:50:00', '2026-02-23 09:15:00', 1, NULL, NULL, 'Case reviewed and endorsed for counseling.', 3, 0, 'Barangay VAW Desk', NULL),
(7,  'GAD-20260128-001', 4,  3, '2026-01-28', '10:00:00', 'Palawig Market',           'Discrimination complaint based on gender filed by a market vendor against a stall owner.', 4, 'pending',   'medium',   13.56961574, 124.14475859, '2026-01-28 10:05:00', '2026-01-28 10:05:00', NULL, NULL, NULL, NULL, 4, 0, NULL, NULL),
(8,  'GAD-20260401-001', 10, 2, '2026-04-01', '13:45:00', 'San Jose Day Care Center', 'Other GAD-related concern raised during a community meeting regarding equal access to daycare services.', 1, 'validated', 'high',     13.59092671, 124.15308174, '2026-04-01 13:50:00', '2026-04-03 10:00:00', NULL, NULL, NULL, 'Validated after consultation with daycare staff.', 6, 0, NULL, NULL),
(9,  'GAD-20260523-001', 2,  2, '2026-05-23', '14:00:00', 'San Jose Covered Court',   'Domestic violence incident reported by a neighbor after hearing a loud altercation.', 3, 'resolved',  'high',     13.59143666, 124.14779212, '2026-05-23 14:05:00', '2026-05-30 11:00:00', NULL, NULL, '2026-05-30 11:00:00', 'Both parties attended counseling and reached settlement.', 6, 0, 'Barangay VAW Desk', 'Case resolved after counseling.'),
(10, 'GAD-20260406-001', 5,  1, '2026-04-06', '20:00:00', 'Purok 2, Lictin',          'Economic abuse reported; victim claimed her income was being controlled by her partner.', 2, 'pending',   'medium',   13.60024671, 124.12501956, '2026-04-06 20:05:00', '2026-04-06 20:05:00', 2, NULL, NULL, NULL, 4, 0, NULL, NULL),
(11, 'GAD-20260219-001', 6,  5, '2026-02-19', '20:45:00', 'Timabaan Riverside',       'Psychological abuse case involving repeated verbal threats made in public.', 6, 'validated', 'medium',   13.60668035, 124.11475716, '2026-02-19 20:50:00', '2026-02-21 09:00:00', NULL, NULL, NULL, 'Validated after witness statements were collected.', 4, 0, NULL, NULL),
(12, 'GAD-20260709-001', 7,  3, '2026-07-09', '18:15:00', 'Purok 1, Palawig',         'Physical abuse incident requiring barangay intervention. Victim sustained bruises on the arm.', 1, 'closed',    'high',     13.57385595, 124.14022530, '2026-07-09 18:20:00', '2026-07-20 16:00:00', NULL, NULL, '2026-07-15 10:00:00', 'Case closed after referral to PNP and DSWD.', 6, 1, 'DSWD', 'Victim placed under protective custody.'),
(13, 'GAD-20260516-001', 10, 1, '2026-05-16', '18:15:00', 'Purok 2, Lictin',          'Other GAD-related concern raised during a community meeting regarding equal participation in local programs.', 2, 'resolved',  'low',      13.60340895, 124.12697779, '2026-05-16 18:20:00', '2026-05-25 10:00:00', NULL, NULL, '2026-05-25 10:00:00', 'Resolved after barangay council addressed the concern.', 2, 0, NULL, 'Addressed through community orientation.'),
(14, 'GAD-20260525-001', 10, 3, '2026-05-25', '13:15:00', 'Palawig Fishing Port',     'Other GAD-related concern raised during a fisherfolk assembly regarding equal benefits for women.', 4, 'pending',   'medium',   13.57156485, 124.13828305, '2026-05-25 13:20:00', '2026-05-25 13:20:00', NULL, NULL, NULL, NULL, 4, 0, NULL, NULL),
(15, 'GAD-20260212-001', 7,  2, '2026-02-12', '09:15:00', 'San Jose Poblacion',       'Physical abuse incident requiring barangay intervention involving a minor.', 3, 'closed',    'high',     13.59318926, 124.14885022, '2026-02-12 09:20:00', '2026-02-25 14:00:00', NULL, NULL, '2026-02-20 10:00:00', 'Case closed after coordination with DSWD.', 6, 0, 'DSWD', 'Minor referred to protective services.'),
(16, 'GAD-20260608-001', 2,  4, '2026-06-08', '18:30:00', 'Rizal Basketball Court',   'Domestic violence incident reported by a neighbor. Barangay tanod responded and pacified the parties.', 5, 'closed',    'low',      13.59909775, 124.15006805, '2026-06-08 18:35:00', '2026-06-15 11:00:00', NULL, NULL, '2026-06-12 10:00:00', 'Closed after both parties agreed to counseling.', 2, 0, NULL, 'Settled through counseling.'),
(17, 'GAD-20260705-001', 2,  3, '2026-07-05', '06:00:00', 'Palawig Barangay Hall',    'Domestic violence incident reported by a neighbor early in the morning.', 4, 'closed',    'low',      13.57543774, 124.13975826, '2026-07-05 06:05:00', '2026-07-12 10:00:00', NULL, NULL, '2026-07-10 09:00:00', 'Both parties underwent counseling and case was closed.', 2, 0, NULL, 'Closed after counseling.'),
(18, 'GAD-20260206-001', 3,  2, '2026-02-06', '12:30:00', 'San Jose Covered Court',   'Sexual harassment complaint filed against a co-worker during a sports event.', 1, 'pending',   'critical', 13.59728965, 124.14770952, '2026-02-06 12:35:00', '2026-02-06 12:35:00', 3, NULL, NULL, NULL, 8, 0, NULL, NULL),
(19, 'GAD-20260306-001', 4,  1, '2026-03-06', '09:30:00', 'Lictin Barangay Hall',     'Discrimination complaint based on gender filed by a barangay employee.', 2, 'validated', 'high',     13.59851184, 124.13077903, '2026-03-06 09:35:00', '2026-03-08 10:00:00', NULL, NULL, NULL, 'Validated after interview with both parties.', 6, 0, NULL, NULL),
(20, 'GAD-20260424-001', 10, 4, '2026-04-24', '17:15:00', 'Rizal Basketball Court',   'Other GAD-related concern raised during a youth assembly about equal opportunities in sports.', 5, 'closed',    'low',      13.60294212, 124.14964540, '2026-04-24 17:20:00', '2026-05-02 10:00:00', NULL, NULL, '2026-04-30 10:00:00', 'Concern addressed by the youth council.', 2, 0, NULL, 'Addressed through youth program.'),
(21, 'GAD-20260109-001', 9,  4, '2026-01-09', '16:00:00', 'Rizal Basketball Court',   'Suspected human trafficking activity reported to barangay officials. Coordination with PNP initiated.', 5, 'pending',   'high',     13.60096825, 124.14548328, '2026-01-09 16:05:00', '2026-01-09 16:05:00', NULL, NULL, NULL, NULL, 6, 0, NULL, NULL),
(22, 'GAD-20260308-001', 1,  2, '2026-03-08', '14:15:00', 'San Jose Barangay Hall',   'Reported case of gender-based violence involving a community member. Victim was provided temporary shelter.', 1, 'closed',    'high',     13.59698255, 124.15164123, '2026-03-08 14:20:00', '2026-03-20 10:00:00', NULL, NULL, '2026-03-15 14:00:00', 'Case endorsed to PNP WCPD for legal action.', 6, 1, 'PNP WCPD', 'Victim referred to women shelter.'),
(23, 'GAD-20260602-001', 5,  3, '2026-06-02', '15:30:00', 'Purok 1, Palawig',         'Economic abuse reported; victim claimed her income was being controlled by partner.', 4, 'closed',    'high',     13.56870284, 124.13990840, '2026-06-02 15:35:00', '2026-06-15 10:00:00', NULL, NULL, '2026-06-12 10:00:00', 'Both parties attended counselling and reached settlement.', 6, 0, 'Barangay VAW Desk', 'Closed after counselling.'),
(24, 'GAD-20260517-001', 6,  4, '2026-05-17', '15:30:00', 'Purok 4, Rizal',           'Psychological abuse case involving repeated verbal threats against a family member.', 5, 'closed',    'critical', 13.60102939, 124.14677822, '2026-05-17 15:35:00', '2026-06-01 10:00:00', NULL, NULL, '2026-05-28 14:00:00', 'Victim referred to mental health services.', 8, 0, 'Rural Health Unit', 'Victim receiving counselling.'),
(25, 'GAD-20260321-001', 1,  1, '2026-03-21', '18:15:00', 'Lictin Barangay Hall',     'Reported case of gender-based violence involving a community member. Victim was referred to VAW Desk.', 2, 'validated', 'critical', 13.60314698, 124.12863483, '2026-03-21 18:20:00', '2026-03-25 10:00:00', 4, NULL, NULL, 'Validated after full interview with complainant.', 8, 1, 'Barangay VAW Desk', NULL),
(26, 'GAD-20260712-001', 4,  5, '2026-07-12', '18:15:00', 'Purok 5, Timabaan',        'Discrimination complaint based on gender filed by a resident against a neighbor.', 6, 'closed',    'critical', 13.60159391, 124.11327098, '2026-07-12 18:20:00', '2026-07-25 10:00:00', NULL, NULL, '2026-07-22 10:00:00', 'Settled after mediation by barangay council.', 8, 0, NULL, 'Closed after mediation.'),
(27, 'GAD-20260120-001', 9,  2, '2026-01-20', '13:00:00', 'Purok 3, San Jose',        'Suspected human trafficking activity reported to barangay officials. Referred to PNP for investigation.', 3, 'resolved',  'high',     13.59480836, 124.14826105, '2026-01-20 13:05:00', '2026-02-05 10:00:00', NULL, NULL, '2026-01-30 10:00:00', 'Resolved after PNP conducted investigation.', 6, 0, 'PNP', 'Referred to PNP for further action.'),
(28, 'GAD-20260417-001', 4,  4, '2026-04-17', '13:45:00', 'Rizal Barangay Hall',      'Discrimination complaint based on gender filed by a barangay health worker.', 1, 'validated', 'high',     13.60111336, 124.14944862, '2026-04-17 13:50:00', '2026-04-20 10:00:00', NULL, NULL, NULL, 'Validated after review of evidence.', 6, 0, NULL, NULL),
(29, 'GAD-20260522-001', 9,  5, '2026-05-22', '20:00:00', 'Timabaan Chapel',          'Suspected human trafficking activity reported to barangay officials during evening mass.', 6, 'pending',   'critical', 13.60582877, 124.11797138, '2026-05-22 20:05:00', '2026-05-22 20:05:00', NULL, NULL, NULL, NULL, 8, 0, NULL, NULL),
(30, 'GAD-20260416-001', 2,  5, '2026-04-16', '14:15:00', 'Timabaan Fishing Port',    'Domestic violence incident reported by a neighbor. Barangay tanod responded immediately.', 1, 'validated', 'medium',   13.60580992, 124.11777304, '2026-04-16 14:20:00', '2026-04-18 10:00:00', NULL, NULL, NULL, 'Validated after both parties were interviewed.', 4, 0, 'Barangay VAW Desk', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `incident_actions`
--

DROP TABLE IF EXISTS `incident_actions`;
CREATE TABLE `incident_actions` (
  `id` int(11) NOT NULL,
  `incident_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `action_type` enum('validated','resolved','closed','referred','assigned') DEFAULT NULL,
  `description` text DEFAULT NULL,
  `action_date` datetime DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `incident_actions` (`id`, `incident_id`, `user_id`, `action_type`, `description`, `action_date`, `created_at`) VALUES
(1,  1,  1, 'validated', 'Verified with barangay blotter and confirmed by complainant.',            '2026-01-02 09:00:00', '2026-01-02 09:00:00'),
(2,  2,  1, 'validated', 'Report reviewed and validated after initial interview.',                   '2026-01-03 10:00:00', '2026-01-03 10:00:00'),
(3,  2,  1, 'resolved',  'Case resolved after mediation between parties.',                           '2026-01-10 15:30:00', '2026-01-10 15:30:00'),
(4,  3,  1, 'validated', 'Verified and endorsed to PNP Women and Children Protection Desk.',         '2026-01-05 10:00:00', '2026-01-05 10:00:00'),
(5,  4,  1, 'resolved',  'Resolved after a dialogue between school administration and complainant.',  '2026-01-12 14:00:00', '2026-01-12 14:00:00'),
(6,  6,  1, 'validated', 'Case reviewed and endorsed for counselling.',                             '2026-02-23 09:15:00', '2026-02-23 09:15:00'),
(7,  8,  1, 'validated', 'Validated after consultation with daycare staff.',                         '2026-04-03 10:00:00', '2026-04-03 10:00:00'),
(8,  9,  1, 'validated', 'Case endorsed to VAW Desk for counselling.',                              '2026-05-25 10:00:00', '2026-05-25 10:00:00'),
(9,  9,  1, 'resolved',  'Case resolved after counselling of both parties.',                         '2026-05-30 11:00:00', '2026-05-30 11:00:00'),
(10, 12, 1, 'closed',    'Case closed after referral to PNP and DSWD.',                              '2026-07-20 16:00:00', '2026-07-20 16:00:00'),
(11, 18, 1, 'assigned',  'Assigned to Barangay VAW Desk for immediate action.',                      '2026-02-07 09:00:00', '2026-02-07 09:00:00'),
(12, 19, 1, 'validated', 'Validated after interview with both parties.',                             '2026-03-08 10:00:00', '2026-03-08 10:00:00'),
(13, 21, 1, 'assigned',  'Referred to PNP for human trafficking investigation.',                     '2026-01-10 09:00:00', '2026-01-10 09:00:00'),
(14, 25, 1, 'validated', 'Validated after full interview with complainant.',                         '2026-03-25 10:00:00', '2026-03-25 10:00:00'),
(15, 28, 1, 'validated', 'Validated after review of evidence.',                                      '2026-04-20 10:00:00', '2026-04-20 10:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `incident_types`
--

DROP TABLE IF EXISTS `incident_types`;
CREATE TABLE `incident_types` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `incident_types` (`id`, `name`, `category`, `description`, `is_active`, `created_at`) VALUES
(1, 'Gender-Based Violence', 'Violence', 'Any form of violence based on gender', 1, '2026-08-13 07:31:06'),
(2, 'Domestic Violence', 'Violence', 'Violence occurring within the household', 1, '2026-08-13 07:31:06'),
(3, 'Sexual Harassment', 'Harassment', 'Unwanted sexual advances or comments', 1, '2026-08-13 07:31:06'),
(4, 'Discrimination', 'Discrimination', 'Unfair treatment based on gender', 1, '2026-08-13 07:31:06'),
(5, 'Economic Abuse', 'Abuse', 'Financial control or exploitation', 1, '2026-08-13 07:31:06'),
(6, 'Psychological Abuse', 'Abuse', 'Emotional or mental abuse', 1, '2026-08-13 07:31:06'),
(7, 'Physical Abuse', 'Abuse', 'Physical harm or injury', 1, '2026-08-13 07:31:06'),
(8, 'Child Abuse', 'Abuse', 'Abuse against children', 1, '2026-08-13 07:31:06'),
(9, 'Trafficking', 'Violence', 'Human trafficking cases', 1, '2026-08-13 07:31:06'),
(10, 'Other GAD-Related', 'Other', 'Other GAD-related incidents', 1, '2026-08-13 07:31:06');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) DEFAULT 'incident',
  `is_read` tinyint(1) DEFAULT 0,
  `link` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `is_read`, `link`, `created_at`) VALUES
(1, 1, 'New Incident Reported', 'A new Gender-Based Violence incident (#GAD-20260101-001) has been reported in Barangay Lictin. Priority: HIGH',      'incident', 0, '../incidents/view.php?id=1',  '2026-01-01 14:35:00'),
(2, 1, 'New Incident Reported', 'A new Domestic Violence incident (#GAD-20260102-002) has been reported in Barangay San Jose. Priority: CRITICAL', 'incident', 0, '../incidents/view.php?id=2',  '2026-01-02 10:05:00'),
(3, 1, 'New Incident Reported', 'A new Sexual Harassment incident (#GAD-20260103-003) has been reported in Barangay Palawig. Priority: HIGH',    'incident', 0, '../incidents/view.php?id=3',  '2026-01-03 15:40:00'),
(4, 1, 'New Incident Reported', 'A new Discrimination incident (#GAD-20260104-004) has been reported in Barangay Rizal. Priority: MEDIUM',       'incident', 0, '../incidents/view.php?id=4',  '2026-01-04 09:05:00'),
(5, 1, 'New Incident Reported', 'A new Gender-Based Violence incident (#GAD-20260105-005) has been reported in Barangay Timabaan. Priority: HIGH','incident', 0, '../incidents/view.php?id=5',  '2026-01-05 11:35:00'),
(6, 1, 'New Incident Reported', 'A new Psychological Abuse incident (#GAD-20260221-001) has been reported in Barangay Palawig. Priority: LOW',   'incident', 0, '../incidents/view.php?id=6',  '2026-02-21 14:50:00'),
(7, 1, 'New Incident Reported', 'A new Sexual Harassment incident (#GAD-20260206-001) has been reported in Barangay San Jose. Priority: CRITICAL','incident', 0, '../incidents/view.php?id=18', '2026-02-06 12:35:00');

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(50) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `created_at`, `updated_at`) VALUES
(0, 'system_name', 'GeoGAD Incident Management System', '2026-08-23 04:27:52', '2026-08-23 04:27:52'),
(0, 'barangay_name', 'San Andres, Catanduanes', '2026-08-23 04:27:52', '2026-08-23 04:27:52'),
(0, 'contact_email', 'geogad@barangay.gov.ph', '2026-08-23 04:27:52', '2026-08-23 04:27:52'),
(0, 'contact_phone', '0900-123-4567', '2026-08-23 04:27:52', '2026-08-23 04:27:52');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(100) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `role` enum('admin','official') DEFAULT 'official',
  `barangay_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `users` (`id`, `username`, `password`, `full_name`, `email`, `role`, `barangay_id`, `is_active`, `last_login`, `created_at`, `updated_at`) VALUES
(1, 'admin', 'admin123', 'System Administrator', 'admin@barangay.gov.ph', 'admin', NULL, 1, '2026-10-10 08:27:42', '2026-08-13 07:31:06', '2026-10-10 00:27:42'),
(2, 'official1', 'official123', 'Juan Dela Cruz', 'juan@lictin.gov.ph', 'official', 1, 1, '2026-10-10 08:44:52', '2026-08-13 07:31:06', '2026-10-10 00:44:52'),
(3, 'official2', 'official123', 'Maria Santos', 'maria@sanjose.gov.ph', 'official', 2, 1, NULL, '2026-08-13 07:31:06', '2026-08-13 07:31:06'),
(4, 'official3', 'official123', 'Jose Rizal', 'jose@palawig.gov.ph', 'official', 3, 1, NULL, '2026-08-13 07:31:06', '2026-08-13 07:31:06'),
(5, 'official4', 'official123', 'Ana Garcia', 'ana@rizal.gov.ph', 'official', 4, 1, NULL, '2026-08-13 07:31:06', '2026-08-13 07:31:06'),
(6, 'official5', 'official123', 'Pedro Reyes', 'pedro@timabaan.gov.ph', 'official', 5, 1, NULL, '2026-08-13 07:31:06', '2026-08-13 07:31:06'),
(7, 'Kai', 'qwerty123', 'Kyla Jane', 'kyla@gmail.com', 'official', 3, 1, NULL, '2026-08-23 06:07:01', '2026-08-23 06:07:01'),
(8, 'toni', 'toni123', 'Toni', 'toni@gmail.com', 'official', 3, 1, '2026-08-23 14:17:45', '2026-08-23 06:17:15', '2026-08-23 06:17:45');

-- --------------------------------------------------------

--
-- Table structure for table `vaw_programs`
--

DROP TABLE IF EXISTS `vaw_programs`;
CREATE TABLE `vaw_programs` (
  `id` int(11) NOT NULL,
  `barangay_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `program_type` enum('training','advocacy','others') DEFAULT 'others',
  `description` text DEFAULT NULL,
  `date_implemented` date DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Indexes for dumped tables
--

ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_action` (`action`),
  ADD KEY `idx_created` (`created_at`);

ALTER TABLE `barangays`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_name` (`name`);

ALTER TABLE `complainants`
  ADD KEY `idx_incident` (`incident_id`);

ALTER TABLE `gad_incidents`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `incident_number` (`incident_number`),
  ADD KEY `incident_type_id` (`incident_type_id`),
  ADD KEY `reported_by` (`reported_by`),
  ADD KEY `idx_incident_number` (`incident_number`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_date` (`incident_date`),
  ADD KEY `idx_barangay` (`barangay_id`),
  ADD KEY `idx_assigned_to` (`assigned_to`),
  ADD KEY `idx_complainant` (`complainant_id`),
  ADD KEY `idx_status_priority` (`status`,`priority`),
  ADD KEY `idx_barangay_date` (`barangay_id`,`incident_date`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_reported_by` (`reported_by`),
  ADD KEY `idx_incident_type` (`incident_type_id`);

ALTER TABLE `incident_actions`
  ADD KEY `idx_incident` (`incident_id`),
  ADD KEY `idx_user` (`user_id`);

ALTER TABLE `incident_types`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_read` (`is_read`),
  ADD KEY `idx_created` (`created_at`),
  ADD KEY `idx_user_read` (`user_id`,`is_read`);

ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_username` (`username`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_role` (`role`);

ALTER TABLE `vaw_programs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_barangay` (`barangay_id`);

--
-- AUTO_INCREMENT for dumped tables
--

ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

ALTER TABLE `barangays`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

ALTER TABLE `gad_incidents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

ALTER TABLE `incident_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

ALTER TABLE `vaw_programs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `gad_incidents`
  ADD CONSTRAINT `gad_incidents_ibfk_1` FOREIGN KEY (`incident_type_id`) REFERENCES `incident_types` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `gad_incidents_ibfk_2` FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `gad_incidents_ibfk_3` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;