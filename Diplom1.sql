IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ConstructionOrders')
BEGIN
    CREATE DATABASE ConstructionOrders;
END
GO

USE ConstructionOrders;
GO

-- УДАЛЕНИЕ 

EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all"
GO

-- Удаляем представления
IF EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N'[dbo].[vw_ActiveObjectTypes]'))
    DROP VIEW [dbo].[vw_ActiveObjectTypes]
GO
IF EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N'[dbo].[vw_OrderProgress]'))
    DROP VIEW [dbo].[vw_OrderProgress]
GO
IF EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N'[dbo].[vw_ContractDetails]'))
    DROP VIEW [dbo].[vw_ContractDetails]
GO
IF EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N'[dbo].[vw_ApplicationsFull]'))
    DROP VIEW [dbo].[vw_ApplicationsFull]
GO
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_OrdersFull')
    DROP VIEW vw_OrdersFull
GO
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_OrderWorksDetails')
    DROP VIEW vw_OrderWorksDetails
GO

-- Удаляем процедуры
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetManagerApplications]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_GetManagerApplications]
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetApplicationDetails]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_GetApplicationDetails]
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_UpdateApplicationStatus]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_UpdateApplicationStatus]
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetManagerStats]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_GetManagerStats]
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetOrCreateClientUser]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_GetOrCreateClientUser]
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_CreateContractFromApplication]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_CreateContractFromApplication]
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_CreateApplication]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_CreateApplication]
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetOrders')
    DROP PROCEDURE sp_GetOrders
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetOrderDetails')
    DROP PROCEDURE sp_GetOrderDetails
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateOrder')
    DROP PROCEDURE sp_UpdateOrder
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_AddOrderWork')
    DROP PROCEDURE sp_AddOrderWork
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateOrderWork')
    DROP PROCEDURE sp_UpdateOrderWork
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_DeleteOrderWork')
    DROP PROCEDURE sp_DeleteOrderWork
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetOrdersStats')
    DROP PROCEDURE sp_GetOrdersStats
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_QuickApproveApplication')
    DROP PROCEDURE sp_QuickApproveApplication
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_SaveProject')
    DROP PROCEDURE sp_SaveProject
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetProjectById ')
    DROP PROCEDURE sp_GetProjectById 
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetWorkTypes')
    DROP PROCEDURE sp_GetWorkTypes
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetAllWorkRules')
    DROP PROCEDURE sp_GetAllWorkRules
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetRecommendedWorks')
    DROP PROCEDURE sp_GetRecommendedWorks
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetClientOrderWorks')
    DROP PROCEDURE sp_GetClientOrderWorks
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetWorkDetails')
    DROP PROCEDURE sp_GetWorkDetails
GO

-- Удаляем триггеры
IF EXISTS (SELECT * FROM sys.triggers WHERE object_id = OBJECT_ID(N'[dbo].[trg_ContractDetails_ValidateDates]'))
    DROP TRIGGER [dbo].[trg_ContractDetails_ValidateDates]
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE object_id = OBJECT_ID(N'[dbo].[trg_Applications_Update]'))
    DROP TRIGGER [dbo].[trg_Applications_Update]
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_OrderWorks_Update')
    DROP TRIGGER trg_OrderWorks_Update
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_Contracts_Update')
    DROP TRIGGER trg_Contracts_Update
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_ClientCompanies_Update')
    DROP TRIGGER trg_ClientCompanies_Update
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_ConstructionObjects_Update')
    DROP TRIGGER trg_ConstructionObjects_Update
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_OrderWorks_UpdateTotalCost')
    DROP TRIGGER trg_OrderWorks_UpdateTotalCost
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_OrderWorks_UpdateAll')
    DROP TRIGGER trg_OrderWorks_UpdateAll
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_Applications_History')
    DROP TRIGGER trg_Applications_History
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_Contracts_History')
    DROP TRIGGER trg_Contracts_History
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_WorkComments_Update')
    DROP TRIGGER trg_WorkComments_Update
GO

-- Удаляем все внешние ключи
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql = @sql + N'
ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(fk.schema_id)) + '.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
FROM sys.foreign_keys AS fk;
EXEC sp_executesql @sql;
GO

-- Удаляем функции
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fn_NumberToWords]') AND type IN (N'FN', N'IF', N'TF'))
    DROP FUNCTION [dbo].[fn_NumberToWords]
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fn_GenerateContractText]') AND type IN (N'FN', N'IF', N'TF'))
    DROP FUNCTION [dbo].[fn_GenerateContractText]
GO

-- Удаляем таблицы
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WorkFiles]') AND type in (N'U'))
    DROP TABLE WorkFiles
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WorkComments]') AND type in (N'U'))
    DROP TABLE WorkComments
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[OrderWorks]') AND type in (N'U'))
    DROP TABLE OrderWorks
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ContractDetails]') AND type in (N'U'))
    DROP TABLE ContractDetails
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Contracts]') AND type in (N'U'))
    DROP TABLE Contracts
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Reviews]') AND type in (N'U'))
    DROP TABLE Reviews
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Applications]') AND type in (N'U'))
    DROP TABLE Applications
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ConstructionObjects]') AND type in (N'U'))
    DROP TABLE ConstructionObjects
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CompanyBankDetails]') AND type in (N'U'))
    DROP TABLE CompanyBankDetails
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientCompanies]') AND type in (N'U'))
    DROP TABLE ClientCompanies
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WorkTypes]') AND type in (N'U'))
    DROP TABLE WorkTypes
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ObjectTypes]') AND type in (N'U'))
    DROP TABLE ObjectTypes
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Projects]') AND type in (N'U'))
    DROP TABLE Projects
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
    DROP TABLE Users
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ProjectImages]') AND type in (N'U'))
    DROP TABLE ProjectImages
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SpecialistHistory]') AND type in (N'U'))
    DROP TABLE SpecialistHistory
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ObjectTypeWorkRequirements]') AND type in (N'U'))
    DROP TABLE ObjectTypeWorkRequirements
GO
-- Services убрана полностью


-- ============================================
-- СОЗДАНИЕ ТАБЛИЦ
-- ============================================

-- Пользователи
CREATE TABLE Users (
    UserID       INT IDENTITY(1,1) PRIMARY KEY,
    Role         VARCHAR(15)  NOT NULL CHECK (Role IN ('client', 'specialist', 'admin')),
    Login        NVARCHAR(50) NOT NULL UNIQUE,
    PasswordHash VARCHAR(64) NOT NULL,
    FullName     NVARCHAR(100) NOT NULL,
    Email        VARCHAR(100) NOT NULL UNIQUE,
    Phone        VARCHAR(15)  NULL,
    CompanyName  NVARCHAR(80) NULL,
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
    LastLoginAt  DATETIME      NULL
);
GO

-- Виды работ (без ServiceID)
CREATE TABLE WorkTypes (
    WorkTypeID      INT IDENTITY(1,1) PRIMARY KEY,
    WorkName        NVARCHAR(150) NOT NULL,
    DefaultDuration SMALLINT           NULL,
	Description NVARCHAR(500) NULL,
    BaseCost        DECIMAL(12,2) NULL,
    IsActive        BIT           NOT NULL DEFAULT 1
);
GO

-- Типы объектов
CREATE TABLE ObjectTypes (
    ObjectTypeID   INT IDENTITY(1,1) PRIMARY KEY,
    TypeName       NVARCHAR(80) NOT NULL UNIQUE,
    Description    NVARCHAR(300) NULL,
    IsActive       BIT NOT NULL DEFAULT 1,
    SortOrder      SMALLINT NOT NULL DEFAULT 0
);
GO

-- Компании-клиенты
CREATE TABLE ClientCompanies (
    CompanyID        INT IDENTITY(1,1) PRIMARY KEY,
    UserID           INT           NOT NULL REFERENCES Users(UserID),
    CompanyName      NVARCHAR(200) NOT NULL,
    UNP              CHAR(9)  NULL,
    OKPO             CHAR(10)  NULL,
    LegalAddress     NVARCHAR(300) NULL,
    DirectorLastName   NVARCHAR(100) NULL,
    DirectorFirstName  NVARCHAR(100) NULL,
    DirectorPatronymic NVARCHAR(100) NULL,
    DirectorPosition NVARCHAR(60) NULL,
    AuthorityDoc     NVARCHAR(50) NULL DEFAULT 'Устав',
    Website          NVARCHAR(150) NULL,
    IsActive         BIT           NOT NULL DEFAULT 1,
    CreatedAt        DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedAt        DATETIME      NULL,
    DirectorFullName AS 
        CASE 
            WHEN DirectorLastName IS NOT NULL OR DirectorFirstName IS NOT NULL OR DirectorPatronymic IS NOT NULL
            THEN CONCAT_WS(' ', DirectorLastName, DirectorFirstName, DirectorPatronymic)
            ELSE NULL
        END
);
GO
CREATE INDEX IX_ClientCompanies_LastName ON ClientCompanies(DirectorLastName);
CREATE INDEX IX_ClientCompanies_FirstName ON ClientCompanies(DirectorFirstName);
GO

-- Банковские реквизиты
CREATE TABLE CompanyBankDetails (
    BankDetailID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID    INT           NOT NULL REFERENCES ClientCompanies(CompanyID),
    BankName     NVARCHAR(150) NOT NULL,
    BankAccount  CHAR(28) NOT NULL,
    BankBIC      CHAR(9)  NOT NULL,
    IsPrimary    BIT           NOT NULL DEFAULT 0,
    IsActive     BIT           NOT NULL DEFAULT 1
);
GO

-- Объекты строительства
CREATE TABLE ConstructionObjects (
    ObjectID        INT IDENTITY(1,1) PRIMARY KEY,
    ClientUserID    INT           NOT NULL REFERENCES Users(UserID),
    ObjectTypeID    INT           NULL REFERENCES ObjectTypes(ObjectTypeID),
    ObjectName      NVARCHAR(200) NULL,
    ObjectAddress   NVARCHAR(300) NOT NULL,
    Description     NVARCHAR(MAX) NULL,
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME      NULL
);
GO

-- Заявки
CREATE TABLE Applications (
    ApplicationID    INT IDENTITY(1,1) PRIMARY KEY,
    ClientUserID     INT           NULL REFERENCES Users(UserID),
    ObjectID         INT           NULL REFERENCES ConstructionObjects(ObjectID),
    SpecialistID     INT           NULL REFERENCES Users(UserID),
    GuestName        NVARCHAR(100) NULL,
    GuestPhone       VARCHAR(15)  NULL,
    GuestEmail       VARCHAR(100) NULL,
    GuestDescription NVARCHAR(MAX) NULL,
    Status           NVARCHAR(20)  NOT NULL DEFAULT 'Новая'
        CHECK (Status IN ('Новая', 'На рассмотрении', 'Одобрена', 'В работе', 'Завершена', 'Отклонена')),
    Source           VARCHAR(20)  NULL DEFAULT 'site',
    Notes            NVARCHAR(MAX) NULL,
    CreatedAt        DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedAt        DATETIME      NULL
);
GO

-- Договоры
CREATE TABLE Contracts (
    ContractID     INT IDENTITY(1,1) PRIMARY KEY,
    ApplicationID  INT           NOT NULL REFERENCES Applications(ApplicationID),
    CompanyID      INT           NOT NULL REFERENCES ClientCompanies(CompanyID),
    ObjectID       INT           NOT NULL REFERENCES ConstructionObjects(ObjectID),
    ContractNumber VARCHAR(30)  NOT NULL UNIQUE,
    SignDate       DATE          NULL,
    City           NVARCHAR(60) NULL DEFAULT 'г. Минск',
    TotalCost      DECIMAL(12,2) NULL,
    ReviewID       INT           NULL,
    IsActive       BIT           NOT NULL DEFAULT 1,
    CreatedAt      DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedAt      DATETIME      NULL
);
GO

-- Детали договора
CREATE TABLE ContractDetails (
    DetailID        INT IDENTITY(1,1) PRIMARY KEY,
    ContractID      INT           NOT NULL REFERENCES Contracts(ContractID),
    StartDate       DATE          NOT NULL,
    EndDate         DATE          NOT NULL,
    CostWithoutVAT  DECIMAL(12,2) NOT NULL,
    VATRate         TINYINT           NOT NULL DEFAULT 20,
    VATAmount       DECIMAL(12,2) NOT NULL,
    VATAmountWords  NVARCHAR(400) NULL,
    TotalCostWords  NVARCHAR(400) NULL,
    PaymentSchedule NVARCHAR(MAX) NULL
);
GO

-- Работы по договору
CREATE TABLE OrderWorks (
    OrderWorkID       INT IDENTITY(1,1) PRIMARY KEY,
    ContractID        INT           NOT NULL REFERENCES Contracts(ContractID),
    WorkTypeID        INT           NOT NULL REFERENCES WorkTypes(WorkTypeID),
    Quantity          DECIMAL(8,2) NOT NULL,
    UnitCost          DECIMAL(12,2) NOT NULL,
    Duration          SMALLINT           NOT NULL,
    SortOrder         SMALLINT           NULL,
    ResponsibleUserID INT           NULL REFERENCES Users(UserID),
    Status            NVARCHAR(15)  NOT NULL DEFAULT 'Не начат'
                          CHECK (Status IN ('Не начат', 'В процессе', 'Выполнен', 'Приостановлен')),
    Comment           NVARCHAR(MAX) NULL,
    CompletedAt       DATETIME      NULL,
    CreatedAt         DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedAt         DATETIME      NULL
);
GO

-- Файлы к работам
CREATE TABLE WorkFiles (
    FileID       INT IDENTITY(1,1) PRIMARY KEY,
    OrderWorkID  INT           NOT NULL REFERENCES OrderWorks(OrderWorkID),
    FileName     NVARCHAR(255) NOT NULL,
    FilePath     NVARCHAR(500) NOT NULL,
    Description  NVARCHAR(500) NULL,
    FileSize     BIGINT        NULL,
    MimeType     NVARCHAR(100) NULL,
    UploadedBy   INT           NOT NULL REFERENCES Users(UserID),
    UploadedAt   DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- Отзывы
CREATE TABLE Reviews (
    ReviewID      INT IDENTITY(1,1) PRIMARY KEY,
    ApplicationID INT           NOT NULL REFERENCES Applications(ApplicationID),
    ClientUserID  INT           NOT NULL REFERENCES Users(UserID),
    Rating        TINYINT       NOT NULL CHECK (Rating BETWEEN 1 AND 5),
    ReviewText    NVARCHAR(MAX) NULL,
    IsApproved    BIT           NOT NULL DEFAULT 0,
    CreatedAt     DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- Проекты (портфолио)
CREATE TABLE Projects (
    Id               INT IDENTITY PRIMARY KEY,
    Title            NVARCHAR(150) NOT NULL,
    Description      NVARCHAR(MAX),
    ShortDescription NVARCHAR(500),
    Category         NVARCHAR(60) NOT NULL,
    Location         NVARCHAR(150),
    Area             DECIMAL(10,2),
    Year             INT,
    Status           NVARCHAR(30),
    MainImage        NVARCHAR(300),
    Images           NVARCHAR(MAX),
    Features         NVARCHAR(MAX),
    CreatedAt        DATETIME DEFAULT GETDATE(),
    UpdatedAt        DATETIME DEFAULT GETDATE(),
    IsPublished      BIT DEFAULT 1,
    SortOrder        SMALLINT DEFAULT 0
);
GO

-- Изображения проектов
CREATE TABLE ProjectImages (
    ImageID    INT IDENTITY(1,1) PRIMARY KEY,
    ProjectID  INT           NOT NULL REFERENCES Projects(Id) ON DELETE CASCADE,
    FileName   NVARCHAR(255) NOT NULL,
    SortOrder  INT           NOT NULL DEFAULT 0,
    UploadedAt DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- История действий специалистов
CREATE TABLE SpecialistHistory (
    HistoryID    INT IDENTITY(1,1) PRIMARY KEY,
    SpecialistID INT           NOT NULL REFERENCES Users(UserID),
    ActionType   NVARCHAR(50)  NOT NULL,
    ActionDate   DATETIME      NOT NULL DEFAULT GETDATE(),
    ApplicationID INT          NULL REFERENCES Applications(ApplicationID),
    OrderID      INT           NULL REFERENCES Contracts(ContractID),
    ClientID     INT           NULL REFERENCES Users(UserID),
    Description  NVARCHAR(500) NULL,
    Details      NVARCHAR(MAX) NULL
);
GO

-- Комментарии к работам
CREATE TABLE WorkComments (
    CommentID         INT IDENTITY(1,1) PRIMARY KEY,
    OrderWorkID       INT           NOT NULL REFERENCES OrderWorks(OrderWorkID) ON DELETE CASCADE,
    AuthorID          INT           NOT NULL REFERENCES Users(UserID),
    CommentText       NVARCHAR(MAX) NOT NULL,
    IsVisibleToClient BIT           NOT NULL DEFAULT 1,
    CreatedAt         DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedAt         DATETIME      NULL
);
GO

-- Правила расчета работ по типу объекта
CREATE TABLE ObjectTypeWorkRequirements (
    RequirementID      INT IDENTITY(1,1) PRIMARY KEY,
    ObjectTypeID       INT           NOT NULL REFERENCES ObjectTypes(ObjectTypeID),
    WorkTypeID         INT           NOT NULL REFERENCES WorkTypes(WorkTypeID),
    InclusionRule      VARCHAR(20)  NOT NULL DEFAULT 'always',
    DurationMultiplier DECIMAL(3,1)  NOT NULL DEFAULT 1.0,
    MinDuration        INT           NULL,
    IsRequired         BIT           NOT NULL DEFAULT 1,
    SortOrder          SMALLINT           NOT NULL DEFAULT 0,
    CONSTRAINT UQ_ObjectType_WorkType UNIQUE (ObjectTypeID, WorkTypeID)
);

CREATE INDEX IX_OTWR_ObjectType ON ObjectTypeWorkRequirements(ObjectTypeID);
GO

-- Включаем проверку внешних ключей обратно
EXEC sp_MSforeachtable "ALTER TABLE ? CHECK CONSTRAINT all"
GO


-- ============================================
-- ПРЕДСТАВЛЕНИЯ
-- ============================================

-- Полная информация о заявках
CREATE VIEW vw_ApplicationsFull AS
SELECT
    a.ApplicationID,
    a.Status,
    a.Source,
    a.CreatedAt,
    a.UpdatedAt,
    a.Notes,
    ISNULL(u.FullName, a.GuestName)     AS ClientName,
    ISNULL(u.Email,    a.GuestEmail)    AS ClientEmail,
    ISNULL(u.Phone,    a.GuestPhone)    AS ClientPhone,
    ISNULL(obj.ObjectAddress, a.GuestDescription) AS ObjectDescription,
    a.GuestDescription,
    s.FullName  AS SpecialistName,
    cc.CompanyName,
    cc.UNP
FROM Applications a
LEFT JOIN Users u              ON a.ClientUserID = u.UserID
LEFT JOIN Users s              ON a.SpecialistID = s.UserID
LEFT JOIN ConstructionObjects obj ON a.ObjectID  = obj.ObjectID
LEFT JOIN ClientCompanies cc   ON u.UserID       = cc.UserID;
GO

-- Детальная информация по договору
CREATE OR ALTER VIEW vw_ContractDetails AS
SELECT
    c.ContractID,
    c.ContractNumber,
    c.SignDate,
    c.City,
    c.TotalCost,
    a.ApplicationID,
    a.Status AS ApplicationStatus,
    u.FullName AS ClientName,
    u.Email AS ClientEmail,
    u.Phone AS ClientPhone,
    cc.CompanyName,
    cc.UNP,
    CONCAT_WS(' ', cc.DirectorLastName, cc.DirectorFirstName, cc.DirectorPatronymic) AS DirectorName,
    obj.ObjectName,
    obj.ObjectAddress,
    ot.TypeName AS ObjectTypeName,
    cd.StartDate,
    cd.EndDate,
    cd.CostWithoutVAT,
    cd.VATRate,
    cd.VATAmount,
    cd.TotalCostWords,
    cd.PaymentSchedule
FROM Contracts c
JOIN Applications a         ON c.ApplicationID = a.ApplicationID
JOIN ClientCompanies cc     ON c.CompanyID     = cc.CompanyID
JOIN Users u                ON cc.UserID       = u.UserID
JOIN ConstructionObjects obj ON c.ObjectID     = obj.ObjectID
LEFT JOIN ObjectTypes ot    ON obj.ObjectTypeID = ot.ObjectTypeID
LEFT JOIN ContractDetails cd ON c.ContractID   = cd.ContractID;
GO

-- Прогресс по работам
CREATE VIEW vw_OrderProgress AS
SELECT
    c.ContractID,
    c.ContractNumber,
    a.ApplicationID,
    obj.ObjectName,
    wt.WorkName,
    ow.Quantity,
    ow.UnitCost,
    ow.Quantity * ow.UnitCost AS TotalWorkCost,
    ow.Duration,
    ow.SortOrder,
    ow.Status,
    ow.Comment,
    ow.CompletedAt,
    u.FullName  AS ResponsibleName,
    u2.FullName AS ClientName
FROM OrderWorks ow
JOIN Contracts c             ON ow.ContractID  = c.ContractID
JOIN Applications a          ON c.ApplicationID = a.ApplicationID
JOIN ConstructionObjects obj ON c.ObjectID     = obj.ObjectID
JOIN WorkTypes wt            ON ow.WorkTypeID  = wt.WorkTypeID
LEFT JOIN Users u            ON ow.ResponsibleUserID = u.UserID
LEFT JOIN Users u2           ON a.ClientUserID = u2.UserID;
GO

-- Активные типы объектов
CREATE VIEW vw_ActiveObjectTypes AS
SELECT ObjectTypeID, TypeName, SortOrder
FROM ObjectTypes
WHERE IsActive = 1;
GO

-- Полная информация о заказах
CREATE VIEW vw_OrdersFull AS
SELECT
    c.ContractID   AS OrderID,
    c.ContractNumber AS OrderNumber,
    a.Status,
    c.TotalCost,
    c.SignDate,
    c.City,
    c.CreatedAt,
    a.Notes,
    ISNULL(u.FullName, a.GuestName)  AS ClientName,
    ISNULL(u.Email,    a.GuestEmail) AS ClientEmail,
    ISNULL(u.Phone,    a.GuestPhone) AS ClientPhone,
    cc.CompanyName,
    cc.UNP,
    cc.OKPO,
    cc.LegalAddress,
    -- НОВЫЕ ПОЛЯ ВМЕСТО DirectorName
    cc.DirectorLastName,
    cc.DirectorFirstName,
    cc.DirectorPatronymic,
    cc.DirectorPosition,
    cc.CompanyID,
    bd.BankName,
    bd.BankAccount,
    bd.BankBIC,
    bd.IsPrimary AS BankIsPrimary,
    co.ObjectName,
    co.ObjectAddress,
    co.Description AS ObjectDescription,
    ot.TypeName     AS ObjectType,
    cd.StartDate,
    cd.EndDate,
    cd.CostWithoutVAT,
    cd.VATRate,
    cd.VATAmount,
    cd.TotalCostWords,
    cd.PaymentSchedule,
    (SELECT COUNT(*) FROM OrderWorks WHERE ContractID = c.ContractID) AS TotalWorks,
    (SELECT COUNT(*) FROM OrderWorks WHERE ContractID = c.ContractID AND Status = 'Выполнен') AS CompletedWorks,
    (SELECT COUNT(*) FROM OrderWorks WHERE ContractID = c.ContractID AND Status = 'В процессе') AS InProgressWorks,
    CASE
        WHEN (SELECT COUNT(*) FROM OrderWorks WHERE ContractID = c.ContractID) > 0
        THEN ROUND(100.0 * (
            SELECT COUNT(*) FROM OrderWorks WHERE ContractID = c.ContractID AND Status = 'Выполнен'
        ) / (SELECT COUNT(*) FROM OrderWorks WHERE ContractID = c.ContractID), 2)
        ELSE 0
    END AS ProgressPercent
FROM Contracts c
JOIN Applications a           ON c.ApplicationID = a.ApplicationID
LEFT JOIN Users u             ON a.ClientUserID  = u.UserID
LEFT JOIN ClientCompanies cc  ON c.CompanyID     = cc.CompanyID
LEFT JOIN CompanyBankDetails bd ON cc.CompanyID  = bd.CompanyID AND (bd.IsPrimary = 1 OR bd.IsPrimary IS NULL)
LEFT JOIN ConstructionObjects co ON c.ObjectID  = co.ObjectID
LEFT JOIN ObjectTypes ot      ON co.ObjectTypeID = ot.ObjectTypeID
LEFT JOIN ContractDetails cd  ON c.ContractID    = cd.ContractID
WHERE a.Status IN ('В работе', 'Завершена');
GO

-- Детальная информация о работах (без Services)
CREATE VIEW vw_OrderWorksDetails AS
SELECT
    ow.OrderWorkID AS WorkID,
    ow.ContractID  AS OrderID,
    ow.WorkTypeID,
    wt.WorkName,
    ow.Quantity,
    ow.UnitCost,
    ow.Quantity * ow.UnitCost AS TotalCost,
    ow.Duration,
    ow.Status,
    ow.Comment,
    ow.CompletedAt,
    ow.ResponsibleUserID,
    u.FullName AS ResponsibleName,
    ow.SortOrder,
    ow.CreatedAt,
    ow.UpdatedAt
FROM OrderWorks ow
JOIN WorkTypes wt ON ow.WorkTypeID = wt.WorkTypeID
LEFT JOIN Users u ON ow.ResponsibleUserID = u.UserID;
GO


-- ============================================
-- ФУНКЦИИ
-- ============================================

CREATE OR ALTER FUNCTION fn_NumberToWords(@num DECIMAL(18,2))
RETURNS NVARCHAR(500)
AS
BEGIN
    DECLARE @result NVARCHAR(500) = '';
    DECLARE @integerPart BIGINT = FLOOR(@num);
    DECLARE @fractionPart INT = ROUND((@num - @integerPart) * 100, 0);

    DECLARE @units TABLE (id INT, word NVARCHAR(20));
    INSERT INTO @units VALUES
        (0, ''), (1, 'один'), (2, 'два'), (3, 'три'), (4, 'четыре'),
        (5, 'пять'), (6, 'шесть'), (7, 'семь'), (8, 'восемь'), (9, 'девять');

    DECLARE @teens TABLE (id INT, word NVARCHAR(20));
    INSERT INTO @teens VALUES
        (10, 'десять'), (11, 'одиннадцать'), (12, 'двенадцать'), (13, 'тринадцать'),
        (14, 'четырнадцать'), (15, 'пятнадцать'), (16, 'шестнадцать'),
        (17, 'семнадцать'), (18, 'восемнадцать'), (19, 'девятнадцать');

    DECLARE @tens TABLE (id INT, word NVARCHAR(20));
    INSERT INTO @tens VALUES
        (2, 'двадцать'), (3, 'тридцать'), (4, 'сорок'), (5, 'пятьдесят'),
        (6, 'шестьдесят'), (7, 'семьдесят'), (8, 'восемьдесят'), (9, 'девяносто');

    DECLARE @hundreds TABLE (id INT, word NVARCHAR(20));
    INSERT INTO @hundreds VALUES
        (1, 'сто'), (2, 'двести'), (3, 'триста'), (4, 'четыреста'),
        (5, 'пятьсот'), (6, 'шестьсот'), (7, 'семьсот'), (8, 'восемьсот'), (9, 'девятьсот');

    DECLARE @numStr NVARCHAR(20) = CAST(@integerPart AS NVARCHAR(20));
    DECLARE @len INT = LEN(@numStr);
    DECLARE @pos INT = 1;
    DECLARE @part INT;
    DECLARE @partResult NVARCHAR(100);

    WHILE @pos <= @len
    BEGIN
        SET @partResult = '';
        DECLARE @digits INT = @len - @pos + 1;
        DECLARE @chunkSize INT;

        IF @digits > 6
            SET @chunkSize = @digits - 6;
        ELSE IF @digits > 3
            SET @chunkSize = @digits - 3;
        ELSE
            SET @chunkSize = @digits;

        DECLARE @chunk INT = CAST(SUBSTRING(@numStr, @pos, @chunkSize) AS INT);

        IF @chunk > 0
        BEGIN
            DECLARE @h INT = @chunk / 100;
            IF @h > 0
                SELECT @partResult = @partResult + ' ' + word FROM @hundreds WHERE id = @h;

            DECLARE @rest INT = @chunk % 100;
            IF @rest >= 10 AND @rest <= 19
            BEGIN
                SELECT @partResult = @partResult + ' ' + word FROM @teens WHERE id = @rest;
            END
            ELSE
            BEGIN
                DECLARE @t INT = @rest / 10;
                IF @t > 0
                    SELECT @partResult = @partResult + ' ' + word FROM @tens WHERE id = @t;

                DECLARE @u INT = @rest % 10;
                IF @u > 0
                BEGIN
                    IF @digits > 3 AND @digits <= 6 AND @u = 1
                        SET @partResult = @partResult + ' одна';
                    ELSE IF @digits > 3 AND @digits <= 6 AND @u = 2
                        SET @partResult = @partResult + ' две';
                    ELSE
                        SELECT @partResult = @partResult + ' ' + word FROM @units WHERE id = @u;
                END
            END

            IF @digits > 6
                SET @partResult = @partResult + CASE
                    WHEN @chunk % 10 = 1 AND @chunk % 100 NOT BETWEEN 11 AND 19 THEN ' миллион'
                    WHEN @chunk % 10 IN (2,3,4) AND @chunk % 100 NOT BETWEEN 11 AND 19 THEN ' миллиона'
                    ELSE ' миллионов'
                END
            ELSE IF @digits > 3
                SET @partResult = @partResult + CASE
                    WHEN @chunk % 10 = 1 AND @chunk % 100 NOT BETWEEN 11 AND 19 THEN ' тысяча'
                    WHEN @chunk % 10 IN (2,3,4) AND @chunk % 100 NOT BETWEEN 11 AND 19 THEN ' тысячи'
                    ELSE ' тысяч'
                END;
        END

        SET @result = @result + ' ' + @partResult;
        SET @pos = @pos + @chunkSize;
    END

    SET @result = LTRIM(@result);
    IF @result = '' SET @result = 'ноль';

    DECLARE @rubleWord NVARCHAR(10);
    IF @integerPart % 10 = 1 AND @integerPart % 100 NOT BETWEEN 11 AND 19
        SET @rubleWord = 'рубль';
    ELSE IF @integerPart % 10 IN (2,3,4) AND @integerPart % 100 NOT BETWEEN 11 AND 19
        SET @rubleWord = 'рубля';
    ELSE
        SET @rubleWord = 'рублей';

    SET @result = @result + ' ' + @rubleWord + ' ' +
                  CASE
                      WHEN @fractionPart < 10 THEN '0' + CAST(@fractionPart AS NVARCHAR)
                      ELSE CAST(@fractionPart AS NVARCHAR)
                  END + ' копеек';

    SET @result = UPPER(LEFT(@result, 1)) + SUBSTRING(@result, 2, LEN(@result));

    RETURN @result;
END
GO


-- ============================================
-- ХРАНИМЫЕ ПРОЦЕДУРЫ
-- ============================================

-- Получение видов работ (без Services)
CREATE PROCEDURE sp_GetWorkTypes
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        WorkTypeID,
        WorkName,
        DefaultDuration,
        BaseCost
    FROM WorkTypes
    WHERE IsActive = 1
    ORDER BY WorkName;
END
GO

-- Получение списка специалистов
CREATE PROCEDURE sp_GetSpecialistsList
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UserID, FullName, Role
    FROM Users
    WHERE Role IN ('specialist', 'admin') AND IsActive = 1
    ORDER BY FullName;
END
GO

-- Получение заказов клиента
CREATE PROCEDURE sp_GetClientOrders
    @ClientUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        c.ContractID AS id,
        c.ContractNumber AS number,
        c.TotalCost AS total,
        ISNULL(co.ObjectName, 'Объект строительства') AS objectName,
        a.Status,
        c.CreatedAt AS date,
        CASE
            WHEN a.Status = 'В работе'  THEN 'work'
            WHEN a.Status = 'Завершена' THEN 'completed'
            ELSE 'new'
        END AS statusClass,
        a.Status AS statusText
    FROM Contracts c
    JOIN Applications a ON c.ApplicationID = a.ApplicationID
    LEFT JOIN ConstructionObjects co ON c.ObjectID = co.ObjectID
    WHERE a.ClientUserID = @ClientUserID
    ORDER BY c.CreatedAt DESC;
END
GO

-- Получение профиля клиента
CREATE PROCEDURE sp_GetClientProfile
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UserID, FullName, Email, Phone, CreatedAt
    FROM Users
    WHERE UserID = @UserID AND Role = 'client';
END
GO

-- Получение документов клиента
CREATE PROCEDURE sp_GetClientDocuments
    @ClientUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        c.ContractID,
        c.ContractNumber AS name,
        c.SignDate AS date
    FROM Contracts c
    JOIN Applications a ON c.ApplicationID = a.ApplicationID
    WHERE a.ClientUserID = @ClientUserID
    ORDER BY c.SignDate DESC;
END
GO

-- Получение банковских реквизитов компании
CREATE PROCEDURE sp_GetCompanyBankDetails
    @CompanyID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT BankDetailID, BankName, BankAccount, BankBIC, IsPrimary
    FROM CompanyBankDetails
    WHERE CompanyID = @CompanyID AND IsActive = 1
    ORDER BY IsPrimary DESC, BankDetailID;
END
GO

-- Сохранение банковских реквизитов
CREATE PROCEDURE sp_SaveCompanyBankDetails
    @CompanyID   INT,
    @BankName    NVARCHAR(300),
    @BankAccount NVARCHAR(100),
    @BankBIC     NVARCHAR(50),
    @IsPrimary   BIT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        IF @IsPrimary = 1
            UPDATE CompanyBankDetails SET IsPrimary = 0 WHERE CompanyID = @CompanyID;

        IF EXISTS (SELECT 1 FROM CompanyBankDetails WHERE CompanyID = @CompanyID)
            UPDATE CompanyBankDetails
            SET BankName = @BankName, BankAccount = @BankAccount, BankBIC = @BankBIC, IsPrimary = @IsPrimary
            WHERE CompanyID = @CompanyID;
        ELSE
            INSERT INTO CompanyBankDetails (CompanyID, BankName, BankAccount, BankBIC, IsPrimary, IsActive)
            VALUES (@CompanyID, @BankName, @BankAccount, @BankBIC, @IsPrimary, 1);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- Проверка уникальности УНП
CREATE PROCEDURE sp_CheckUNPExists
    @UNP             NVARCHAR(50),
    @ExcludeCompanyID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(*) AS cnt FROM ClientCompanies
    WHERE UNP = @UNP AND (@ExcludeCompanyID IS NULL OR CompanyID != @ExcludeCompanyID);
END
GO

-- Получение типов объектов
CREATE PROCEDURE sp_GetObjectTypes
    @IncludeInactive BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ObjectTypeID, TypeName
    FROM ObjectTypes
    WHERE @IncludeInactive = 1 OR IsActive = 1
    ORDER BY SortOrder, TypeName;
END
GO

-- Получение категорий проектов
CREATE PROCEDURE sp_GetProjectCategories
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT Category FROM Projects
    WHERE Category IS NOT NULL AND Category != ''
    ORDER BY Category;
END
GO

-- Получение всех правил расчета (без Services)
CREATE PROCEDURE sp_GetAllWorkRules
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        r.RequirementID,
        r.ObjectTypeID,
        ot.TypeName AS ObjectTypeName,
        r.WorkTypeID,
        wt.WorkName,
        r.InclusionRule,
        r.DurationMultiplier,
        r.MinDuration,
        r.IsRequired,
        r.SortOrder
    FROM ObjectTypeWorkRequirements r
    JOIN ObjectTypes ot ON r.ObjectTypeID = ot.ObjectTypeID
    JOIN WorkTypes   wt ON r.WorkTypeID   = wt.WorkTypeID
    ORDER BY ot.TypeName, r.SortOrder, wt.WorkName;
END
GO

-- Получение правила по ID
CREATE PROCEDURE sp_GetWorkRuleById
    @RequirementID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM ObjectTypeWorkRequirements WHERE RequirementID = @RequirementID;
END
GO

-- Создание правила
CREATE PROCEDURE sp_CreateWorkRule
    @ObjectTypeID       INT,
    @WorkTypeID         INT,
    @InclusionRule      NVARCHAR(20),
    @DurationMultiplier DECIMAL(3,1),
    @MinDuration        INT = NULL,
    @IsRequired         BIT = 1,
    @SortOrder          INT = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM ObjectTypeWorkRequirements WHERE ObjectTypeID = @ObjectTypeID AND WorkTypeID = @WorkTypeID)
    BEGIN
        RAISERROR('Правило для этого типа объекта и работы уже существует', 16, 1);
        RETURN;
    END
    INSERT INTO ObjectTypeWorkRequirements (ObjectTypeID, WorkTypeID, InclusionRule, DurationMultiplier, MinDuration, IsRequired, SortOrder)
    VALUES (@ObjectTypeID, @WorkTypeID, @InclusionRule, @DurationMultiplier, @MinDuration, @IsRequired, @SortOrder);
    SELECT SCOPE_IDENTITY() AS RequirementID;
END
GO

-- Обновление правила
CREATE PROCEDURE sp_UpdateWorkRule
    @RequirementID      INT,
    @ObjectTypeID       INT,
    @WorkTypeID         INT,
    @InclusionRule      NVARCHAR(20),
    @DurationMultiplier DECIMAL(3,1),
    @MinDuration        INT = NULL,
    @IsRequired         BIT = 1,
    @SortOrder          INT = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM ObjectTypeWorkRequirements
               WHERE ObjectTypeID = @ObjectTypeID AND WorkTypeID = @WorkTypeID AND RequirementID != @RequirementID)
    BEGIN
        RAISERROR('Правило для этого типа объекта и работы уже существует', 16, 1);
        RETURN;
    END
    UPDATE ObjectTypeWorkRequirements
    SET ObjectTypeID = @ObjectTypeID, WorkTypeID = @WorkTypeID, InclusionRule = @InclusionRule,
        DurationMultiplier = @DurationMultiplier, MinDuration = @MinDuration, IsRequired = @IsRequired, SortOrder = @SortOrder
    WHERE RequirementID = @RequirementID;
END
GO

-- Удаление правила
CREATE PROCEDURE sp_DeleteWorkRule
    @RequirementID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM ObjectTypeWorkRequirements WHERE RequirementID = @RequirementID;
END
GO

-- Создание заявки
CREATE PROCEDURE sp_CreateApplication
    @GuestName        NVARCHAR(200) = NULL,
    @GuestPhone       NVARCHAR(20)  = NULL,
    @GuestEmail       NVARCHAR(150) = NULL,
    @GuestDescription NVARCHAR(MAX) = NULL,
    @Source           NVARCHAR(50)  = 'site',
    @ApplicationID    INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO Applications (GuestName, GuestPhone, GuestEmail, GuestDescription, Status, Source, CreatedAt)
    VALUES (@GuestName, @GuestPhone, @GuestEmail, @GuestDescription, 'Новая', @Source, GETDATE());
    SET @ApplicationID = SCOPE_IDENTITY();
    RETURN @ApplicationID;
END
GO

-- Создание/получение клиента
CREATE PROCEDURE sp_GetOrCreateClientUser
    @Email             NVARCHAR(150),
    @Name              NVARCHAR(200),
    @Phone             NVARCHAR(20)  = NULL,
    @ApplicationID     INT           = NULL,
    @UserID            INT OUTPUT,
    @IsNew             BIT OUTPUT,
    @TemporaryPassword NVARCHAR(50)  OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT @UserID = UserID FROM Users WHERE Email = @Email;
    IF @UserID IS NOT NULL
    BEGIN
        SET @IsNew = 0;
        SET @TemporaryPassword = NULL;
    END
    ELSE
    BEGIN
        DECLARE @chars VARCHAR(36) = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        DECLARE @password VARCHAR(8) = '';
        DECLARE @i INT = 1, @rand INT;
        WHILE @i <= 8
        BEGIN
            SET @rand = CAST(RAND() * 36 + 1 AS INT);
            SET @password = @password + SUBSTRING(@chars, @rand, 1);
            SET @i = @i + 1;
        END
        SET @TemporaryPassword = @password;

        DECLARE @Login NVARCHAR(100);
        DECLARE @atIndex INT = CHARINDEX('@', @Email);
        IF @atIndex > 0
        BEGIN
            DECLARE @loginBase NVARCHAR(50) = LEFT(@Email, @atIndex - 1);
            SET @loginBase = REPLACE(REPLACE(REPLACE(@loginBase, '.', ''), '-', ''), '_', '');
            IF LEN(@loginBase) > 30 SET @loginBase = LEFT(@loginBase, 30);
            SET @Login = @loginBase + CAST(CAST(RAND() * 1000 AS INT) AS NVARCHAR);
        END
        ELSE
            SET @Login = LEFT(@Email, 30) + CAST(CAST(RAND() * 1000 AS INT) AS NVARCHAR);

        INSERT INTO Users (Role, Login, PasswordHash, FullName, Email, Phone)
        VALUES ('client', @Login, '', @Name, @Email, @Phone);
        SET @UserID = SCOPE_IDENTITY();
        SET @IsNew = 1;
    END
    IF @ApplicationID IS NOT NULL AND @UserID IS NOT NULL
        UPDATE Applications SET ClientUserID = @UserID WHERE ApplicationID = @ApplicationID;
END
GO

-- Получение заявок для менеджера
CREATE PROCEDURE sp_GetManagerApplications
    @Filter    NVARCHAR(50)  = 'all',
    @Page      INT           = 1,
    @PageSize  INT           = 10,
    @Search    NVARCHAR(100) = '',
    @UserRole  NVARCHAR(20)  = NULL,
    @UserID    INT           = NULL,
    @SortBy NVARCHAR(50) = 'createdAt_desc'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;

    SELECT
        a.ApplicationID AS Id,
        ISNULL(u.FullName, a.GuestName) AS Name,
        ISNULL(u.Phone,    a.GuestPhone) AS Phone,
        ISNULL(u.Email,    a.GuestEmail) AS Email,
        a.GuestDescription AS Message,
        obj.ObjectAddress  AS Address,
        a.Status, a.Source, a.CreatedAt, a.UpdatedAt, a.Notes,
        cc.CompanyName,
        c.TotalCost,
        c.ContractNumber,
        c.ContractID AS OrderID,
        -- ДОБАВЛЯЕМ ТИП ОБЪЕКТА
        a.ObjectTypeID,                                    -- ID типа
        ot.TypeName AS ObjectTypeName                      -- Название типа
    FROM Applications a
    LEFT JOIN Users u                 ON a.ClientUserID = u.UserID
    LEFT JOIN ConstructionObjects obj ON a.ObjectID     = obj.ObjectID
    LEFT JOIN ClientCompanies cc      ON u.UserID       = cc.UserID
    LEFT JOIN Contracts c             ON a.ApplicationID = c.ApplicationID
    LEFT JOIN ObjectTypes ot          ON a.ObjectTypeID = ot.ObjectTypeID   -- <-- ДОБАВЛЯЕМ ЭТОТ JOIN
    WHERE (@Filter = 'all' OR a.Status = @Filter)
        AND (@Search = '' OR
             ISNULL(u.FullName, a.GuestName)  LIKE '%' + @Search + '%' OR
             ISNULL(u.Phone,    a.GuestPhone) LIKE '%' + @Search + '%' OR
             ISNULL(u.Email,    a.GuestEmail) LIKE '%' + @Search + '%' OR
             ISNULL(cc.CompanyName, '')        LIKE '%' + @Search + '%')
    ORDER BY 
        CASE WHEN @SortBy = 'createdAt_desc' THEN a.CreatedAt END DESC,
        CASE WHEN @SortBy = 'createdAt_asc'  THEN a.CreatedAt END ASC,
        CASE WHEN @SortBy = 'name_asc'       THEN ISNULL(u.FullName, a.GuestName) END ASC,
        CASE WHEN @SortBy = 'name_desc'      THEN ISNULL(u.FullName, a.GuestName) END DESC,
        CASE WHEN @SortBy = 'company_asc'    THEN cc.CompanyName END ASC,
        CASE WHEN @SortBy = 'company_desc'   THEN cc.CompanyName END DESC,
        CASE WHEN @SortBy = 'phone_asc'      THEN ISNULL(u.Phone, a.GuestPhone) END ASC,
        CASE WHEN @SortBy = 'phone_desc'     THEN ISNULL(u.Phone, a.GuestPhone) END DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(*) AS TotalCount
    FROM Applications a
    LEFT JOIN Users u            ON a.ClientUserID = u.UserID
    LEFT JOIN ClientCompanies cc ON u.UserID       = cc.UserID
    WHERE (@Filter = 'all' OR a.Status = @Filter)
        AND (@Search = '' OR
             ISNULL(u.FullName, a.GuestName)  LIKE '%' + @Search + '%' OR
             ISNULL(cc.CompanyName, '')        LIKE '%' + @Search + '%');
END
GO

-- Детали заявки
CREATE OR ALTER PROCEDURE sp_GetApplicationDetails
    @ApplicationID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        a.ApplicationID,
        a.Status,
        a.Source,
        a.CreatedAt,
        a.UpdatedAt,
        a.Notes,
        
        ISNULL(u.FullName, a.GuestName) AS ClientName,
        ISNULL(u.Email, a.GuestEmail) AS ClientEmail,
        ISNULL(u.Phone, a.GuestPhone) AS ClientPhone,
        
        a.GuestName,
        a.GuestPhone,
        a.GuestEmail,
        a.GuestDescription AS Message,
        
        obj.ObjectAddress,
        obj.ObjectName,
        ot.TypeName AS ObjectType,
        ot.ObjectTypeID,
        
        cc.CompanyName,
        cc.UNP,
        cc.OKPO,
        cc.LegalAddress,
        cc.DirectorLastName,
        cc.DirectorFirstName,
        cc.DirectorPatronymic,
        cc.DirectorPosition,
        cc.AuthorityDoc,
        cc.Website,
        CONCAT_WS(' ', cc.DirectorLastName, cc.DirectorFirstName, cc.DirectorPatronymic) AS DirectorName,
        
        cbd.BankName,
        cbd.BankAccount,
        cbd.BankBIC,
        
        c.ContractNumber,
        c.SignDate AS ContractDate,
        c.City,
        c.TotalCost,
        
        cd.StartDate,
        cd.EndDate,
        cd.CostWithoutVAT,
        cd.VATRate,
        cd.VATAmount,
        cd.TotalCostWords,
        cd.PaymentSchedule
        
    FROM Applications a
    LEFT JOIN Users u ON a.ClientUserID = u.UserID
    LEFT JOIN ConstructionObjects obj ON a.ObjectID = obj.ObjectID
    LEFT JOIN ObjectTypes ot ON obj.ObjectTypeID = ot.ObjectTypeID
    LEFT JOIN ClientCompanies cc ON u.UserID = cc.UserID
    LEFT JOIN CompanyBankDetails cbd ON cc.CompanyID = cbd.CompanyID AND cbd.IsPrimary = 1
    LEFT JOIN Contracts c ON a.ApplicationID = c.ApplicationID
    LEFT JOIN ContractDetails cd ON c.ContractID = cd.ContractID
    WHERE a.ApplicationID = @ApplicationID;
END;
GO

-- Обновление статуса заявки
CREATE PROCEDURE sp_UpdateApplicationStatus
    @ApplicationID  INT,
    @Status         NVARCHAR(50),
    @Notes          NVARCHAR(MAX) = NULL,
    @SpecialistID   INT           = NULL,
    @ShouldSendEmail BIT          OUTPUT,
    @ClientEmail    NVARCHAR(150) OUTPUT,
    @ClientName     NVARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Applications
    SET Status      = @Status,
        Notes       = CASE WHEN @Notes       IS NOT NULL THEN @Notes       ELSE Notes       END,
        SpecialistID = CASE WHEN @SpecialistID IS NOT NULL THEN @SpecialistID ELSE SpecialistID END,
        UpdatedAt   = GETDATE()
    WHERE ApplicationID = @ApplicationID;

    SELECT
        @ClientEmail     = ISNULL(u.Email,    a.GuestEmail),
        @ClientName      = ISNULL(u.FullName, a.GuestName),
        @ShouldSendEmail = CASE WHEN @Status = 'В работе' AND (u.Email IS NOT NULL OR a.GuestEmail IS NOT NULL) THEN 1 ELSE 0 END
    FROM Applications a
    LEFT JOIN Users u ON a.ClientUserID = u.UserID
    WHERE a.ApplicationID = @ApplicationID;
END
GO

-- Статистика менеджера
CREATE PROCEDURE sp_GetManagerStats
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        COUNT(*) AS totalLeads,
        SUM(CASE WHEN Status = 'Новая'          THEN 1 ELSE 0 END) AS newLeads,
        SUM(CASE WHEN Status = 'На рассмотрении' THEN 1 ELSE 0 END) AS contactedLeads,
        SUM(CASE WHEN Status = 'В работе'       THEN 1 ELSE 0 END) AS inProgressLeads,
        SUM(CASE WHEN Status = 'Завершена'      THEN 1 ELSE 0 END) AS completedLeads,
        SUM(CASE WHEN Status = 'Отклонена'      THEN 1 ELSE 0 END) AS rejectedLeads
    FROM Applications;

    SELECT
        COUNT(*) AS totalReviews,
        SUM(CASE WHEN IsApproved = 0 THEN 1 ELSE 0 END) AS pendingReviews,
        SUM(CASE WHEN IsApproved = 1 THEN 1 ELSE 0 END) AS approvedReviews
    FROM Reviews;
END
GO

-- Создание договора из заявки
CREATE OR ALTER PROCEDURE sp_CreateContractFromApplication
    @ApplicationID   INT,
    @UserID          INT,
    @CompanyName     NVARCHAR(300),
    @UNP             NVARCHAR(50),
    @OKPO            NVARCHAR(50)  = NULL,
    @DirectorLastName NVARCHAR(100) = NULL,
    @DirectorFirstName NVARCHAR(100) = NULL,
    @DirectorPatronymic NVARCHAR(100) = NULL,
    @DirectorPosition NVARCHAR(100),
    @LegalAddress    NVARCHAR(500),
    @BankName        NVARCHAR(300),
    @BankAccount     NVARCHAR(100),
    @BankBIC         NVARCHAR(50),
    @ObjectTypeID    INT,
    @ObjectName      NVARCHAR(500),
    @ObjectAddress   NVARCHAR(500),
    @ContractNumber  NVARCHAR(50),
    @SignDate        DATE,
    @City            NVARCHAR(100) = 'г. Минск',
    @StartDate       DATE,
    @EndDate         DATE,
    @CostWithoutVAT  DECIMAL(18,2),
    @VATRate         INT           = 20,
    @PaymentSchedule NVARCHAR(MAX) = NULL,
    @ContractID      INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @ClientUserID INT, @CompanyID INT, @ObjectID INT;
        DECLARE @VATAmount DECIMAL(18,2) = @CostWithoutVAT * @VATRate / 100;
        DECLARE @TotalCost DECIMAL(18,2) = @CostWithoutVAT + @VATAmount;

        SELECT @ClientUserID = ClientUserID FROM Applications WHERE ApplicationID = @ApplicationID;

        IF @ClientUserID IS NULL
        BEGIN
            DECLARE @GuestEmail NVARCHAR(150), @GuestName NVARCHAR(200), @GuestPhone NVARCHAR(20);
            SELECT @GuestEmail = GuestEmail, @GuestName = GuestName, @GuestPhone = GuestPhone
            FROM Applications WHERE ApplicationID = @ApplicationID;
            
            SELECT @ClientUserID = UserID FROM Users WHERE Email = @GuestEmail;
            
            IF @ClientUserID IS NULL
            BEGIN
                DECLARE @Login NVARCHAR(100) = LOWER(REPLACE(LEFT(@GuestEmail, CHARINDEX('@', @GuestEmail) - 1), '.', '')) + CAST(CAST(RAND() * 1000 AS INT) AS NVARCHAR);
                INSERT INTO Users (Role, Login, PasswordHash, FullName, Email, Phone)
                VALUES ('client', @Login, '', @GuestName, @GuestEmail, @GuestPhone);
                SET @ClientUserID = SCOPE_IDENTITY();
            END
            UPDATE Applications SET ClientUserID = @ClientUserID WHERE ApplicationID = @ApplicationID;
        END

        SELECT @CompanyID = CompanyID FROM ClientCompanies WHERE UserID = @ClientUserID;
        
        IF @CompanyID IS NULL
        BEGIN
            INSERT INTO ClientCompanies (
                UserID, CompanyName, UNP, OKPO, LegalAddress,
                DirectorLastName, DirectorFirstName, DirectorPatronymic, DirectorPosition, AuthorityDoc
            )
            VALUES (
                @ClientUserID, @CompanyName, @UNP, @OKPO, @LegalAddress,
                @DirectorLastName, @DirectorFirstName, @DirectorPatronymic, @DirectorPosition, 'Устав'
            );
            SET @CompanyID = SCOPE_IDENTITY();
            
            IF @BankName IS NOT NULL AND @BankAccount IS NOT NULL AND @BankBIC IS NOT NULL
                INSERT INTO CompanyBankDetails (CompanyID, BankName, BankAccount, BankBIC, IsPrimary)
                VALUES (@CompanyID, @BankName, @BankAccount, @BankBIC, 1);
        END

        DECLARE @GuestDescription NVARCHAR(MAX);
        SELECT @GuestDescription = GuestDescription FROM Applications WHERE ApplicationID = @ApplicationID;

        INSERT INTO ConstructionObjects (ClientUserID, ObjectTypeID, ObjectName, ObjectAddress, Description)
        VALUES (@ClientUserID, @ObjectTypeID, @ObjectName, @ObjectAddress, @GuestDescription);
        SET @ObjectID = SCOPE_IDENTITY();

        UPDATE Applications 
        SET ObjectID = @ObjectID, SpecialistID = @UserID, Status = 'В работе', UpdatedAt = GETDATE()
        WHERE ApplicationID = @ApplicationID;

        INSERT INTO Contracts (ApplicationID, CompanyID, ObjectID, ContractNumber, SignDate, City, TotalCost, IsActive, CreatedAt)
        VALUES (@ApplicationID, @CompanyID, @ObjectID, @ContractNumber, @SignDate, @City, @TotalCost, 1, GETDATE());
        SET @ContractID = SCOPE_IDENTITY();

        INSERT INTO ContractDetails (ContractID, StartDate, EndDate, CostWithoutVAT, VATRate, VATAmount, TotalCostWords, PaymentSchedule)
        VALUES (@ContractID, @StartDate, @EndDate, @CostWithoutVAT, @VATRate, @VATAmount, NULL, @PaymentSchedule);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- Получение списка заказов
CREATE PROCEDURE sp_GetOrders
    @Page     INT           = 1,
    @PageSize INT           = 10,
    @Search   NVARCHAR(100) = ''
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;

    -- Временная таблица для пагинации
    SELECT 
        OrderID, 
        OrderNumber, 
        Status, 
        TotalCost, 
        ClientName, 
        CompanyName,
        ObjectName, 
        ObjectAddress, 
        CreatedAt, 
        TotalWorks, 
        CompletedWorks, 
        ProgressPercent,
        ROW_NUMBER() OVER (ORDER BY CASE WHEN Status = 'В работе' THEN 1 ELSE 2 END, CreatedAt DESC) AS RowNum
    INTO #TempOrders
    FROM vw_OrdersFull
    WHERE (@Search = '' OR
           OrderNumber  LIKE '%' + @Search + '%' OR
           ClientName   LIKE '%' + @Search + '%' OR
           CompanyName  LIKE '%' + @Search + '%' OR
           ObjectName   LIKE '%' + @Search + '%');

    -- Возвращаем отфильтрованные данные
    SELECT 
        OrderID, OrderNumber, Status, TotalCost, ClientName, CompanyName,
        ObjectName, ObjectAddress, CreatedAt, TotalWorks, CompletedWorks, ProgressPercent
    FROM #TempOrders
    WHERE RowNum BETWEEN @Offset + 1 AND @Offset + @PageSize
    ORDER BY RowNum;

    -- Общее количество
    SELECT COUNT(*) AS TotalCount FROM #TempOrders;

    DROP TABLE #TempOrders;
END
GO

-- Детали заказа
CREATE OR ALTER PROCEDURE sp_GetOrderDetails
    @OrderID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Основная информация о заказе (из твоего второго ALTER)
    SELECT 
        c.ContractID AS Id,
        c.ContractNumber AS OrderNumber,
        c.SignDate,
        c.City,
        a.Status,
        a.Notes,
        co.ObjectName,
        co.ObjectAddress,
        co.Description AS ObjectDescription,
        ot.TypeName AS ObjectType,
        c.CreatedAt,
        cc.CompanyID,
        cc.CompanyName,
        cc.UNP,
        cc.OKPO,
        cc.LegalAddress,
        cc.DirectorLastName,
        cc.DirectorFirstName,
        cc.DirectorPatronymic,
        cc.DirectorPosition,
        u.Email AS ClientEmail,
        u.Phone AS ClientPhone,
        bd.BankName,
        bd.BankAccount,
        bd.BankBIC,
        bd.IsPrimary AS BankIsPrimary,
        (SELECT ISNULL(SUM(Quantity * UnitCost), 0) FROM OrderWorks WHERE ContractID = c.ContractID) AS TotalCost
    FROM Contracts c
    INNER JOIN Applications a ON c.ApplicationID = a.ApplicationID
    INNER JOIN ClientCompanies cc ON c.CompanyID = cc.CompanyID
    LEFT JOIN Users u ON cc.UserID = u.UserID
    LEFT JOIN ConstructionObjects co ON c.ObjectID = co.ObjectID
    LEFT JOIN ObjectTypes ot ON co.ObjectTypeID = ot.ObjectTypeID
    LEFT JOIN CompanyBankDetails bd ON cc.CompanyID = bd.CompanyID AND bd.IsPrimary = 1
    WHERE c.ContractID = @OrderID;
    
    -- Работы по заказу
    SELECT 
        ow.OrderWorkID AS WorkID,
        ow.ContractID,
        ow.WorkTypeID,
        ow.Quantity,
        ow.UnitCost,
        ow.Duration,
        ow.Status,
        ow.Comment,
        ow.ResponsibleUserID,
        wt.WorkName,
        u2.FullName AS ResponsibleName,
        (ow.Quantity * ow.UnitCost) AS TotalCost
    FROM OrderWorks ow
    LEFT JOIN WorkTypes wt ON ow.WorkTypeID = wt.WorkTypeID
    LEFT JOIN Users u2 ON ow.ResponsibleUserID = u2.UserID
    WHERE ow.ContractID = @OrderID
    ORDER BY ow.OrderWorkID;
    
    -- Детали договора
    SELECT 
        StartDate,
        EndDate,
        CostWithoutVAT,
        VATRate,
        VATAmount,
        VATAmountWords,
        TotalCostWords,
        PaymentSchedule
    FROM ContractDetails
    WHERE ContractID = @OrderID;
END
GO

CREATE OR ALTER PROCEDURE sp_UpdateOrder
    @OrderID           INT,
    @ContractNumber    NVARCHAR(50)  = NULL,
    @SignDate          DATE          = NULL,
    @City              NVARCHAR(100) = NULL,
    @Status            NVARCHAR(50)  = NULL,
    @Notes             NVARCHAR(MAX) = NULL,
    @CompanyName       NVARCHAR(300) = NULL,
    @UNP               NVARCHAR(50)  = NULL,
    @OKPO              NVARCHAR(50)  = NULL,
    @LegalAddress      NVARCHAR(500) = NULL,
    @DirectorLastName  NVARCHAR(100) = NULL,
    @DirectorFirstName NVARCHAR(100) = NULL,
    @DirectorPatronymic NVARCHAR(100) = NULL,
    @DirectorPosition  NVARCHAR(100) = NULL,
    @ClientEmail       NVARCHAR(150) = NULL,
    @ClientPhone       NVARCHAR(20)  = NULL,
    @ObjectName        NVARCHAR(500) = NULL,
    @ObjectAddress     NVARCHAR(500) = NULL,
    @ObjectDescription NVARCHAR(MAX) = NULL,
    @ObjectTypeID      INT           = NULL,  -- <-- ИЗ АЛЬТЕРА 2
    @BankName          NVARCHAR(300) = NULL,
    @BankAccount       NVARCHAR(100) = NULL,
    @BankBIC           NVARCHAR(50)  = NULL,
    @BankIsPrimary     BIT           = NULL,
    @StartDate         DATE          = NULL,
    @EndDate           DATE          = NULL,
    @CostWithoutVAT    DECIMAL(18,2) = NULL,
    @VATRate           INT           = NULL,
    @VATAmount         DECIMAL(18,2) = NULL,
    @VATAmountWords    NVARCHAR(500) = NULL,
    @TotalCostWords    NVARCHAR(500) = NULL,
    @PaymentSchedule   NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @ApplicationID INT, @CompanyID INT, @ObjectID INT, @UserID INT;
        DECLARE @CurrentCostWithoutVAT DECIMAL(18,2), @CurrentVATRate INT, @CurrentVATAmount DECIMAL(18,2);
        DECLARE @FinalCostWithoutVAT DECIMAL(18,2), @FinalVATRate INT, @FinalVATAmount DECIMAL(18,2), @FinalTotalCost DECIMAL(18,2);

        -- Получаем связанные ID
        SELECT @ApplicationID = c.ApplicationID, @CompanyID = c.CompanyID, @ObjectID = c.ObjectID
        FROM Contracts c
        WHERE c.ContractID = @OrderID;

        -- Получаем UserID из Applications
        SELECT @UserID = a.ClientUserID
        FROM Applications a
        WHERE a.ApplicationID = @ApplicationID;

        -- Получаем текущие значения из ContractDetails
        SELECT @CurrentCostWithoutVAT = cd.CostWithoutVAT, @CurrentVATRate = cd.VATRate, @CurrentVATAmount = cd.VATAmount
        FROM ContractDetails cd
        WHERE cd.ContractID = @OrderID;

        -- 1. Обновляем Contracts (с ObjectTypeID из альтера 2)
        UPDATE Contracts SET
            ContractNumber = ISNULL(@ContractNumber, ContractNumber),
            SignDate = ISNULL(@SignDate, SignDate),
            City = ISNULL(@City, City),
            ObjectTypeID = ISNULL(@ObjectTypeID, ObjectTypeID)  -- <-- ИЗ АЛЬТЕРА 2
        WHERE ContractID = @OrderID;

        -- 2. Обновляем Applications (статус и заметки)
        IF @Status IS NOT NULL OR @Notes IS NOT NULL
            UPDATE Applications SET
                Status = ISNULL(@Status, Status),
                Notes = ISNULL(@Notes, Notes),
                UpdatedAt = GETDATE()
            WHERE ApplicationID = @ApplicationID;

        -- 3. Обновляем компанию клиента (ТОЛЬКО для этого заказа - из альтера 1)
        IF @CompanyID IS NOT NULL
        BEGIN
            UPDATE ClientCompanies SET
                CompanyName = ISNULL(@CompanyName, CompanyName),
                UNP = ISNULL(@UNP, UNP),
                OKPO = ISNULL(@OKPO, OKPO),
                LegalAddress = ISNULL(@LegalAddress, LegalAddress),
                DirectorLastName = ISNULL(@DirectorLastName, DirectorLastName),
                DirectorFirstName = ISNULL(@DirectorFirstName, DirectorFirstName),
                DirectorPatronymic = ISNULL(@DirectorPatronymic, DirectorPatronymic),
                DirectorPosition = ISNULL(@DirectorPosition, DirectorPosition)
            WHERE CompanyID = @CompanyID;
        END

        -- 4. Обновляем пользователя (email и телефон) - ЭТО ОБЩИЕ ДАННЫЕ (из альтера 1)
        IF @UserID IS NOT NULL AND (@ClientEmail IS NOT NULL OR @ClientPhone IS NOT NULL)
            UPDATE Users SET
                Email = ISNULL(@ClientEmail, Email),
                Phone = ISNULL(@ClientPhone, Phone)
            WHERE UserID = @UserID;

        -- 5. Обновляем объект строительства (ТОЛЬКО для этого заказа - из альтера 1)
        IF @ObjectID IS NOT NULL
        BEGIN
            UPDATE ConstructionObjects SET
                ObjectName = ISNULL(@ObjectName, ObjectName),
                ObjectAddress = ISNULL(@ObjectAddress, ObjectAddress),
                Description = ISNULL(@ObjectDescription, Description),
                ObjectTypeID = ISNULL(@ObjectTypeID, ObjectTypeID),  -- <-- ИЗ АЛЬТЕРА 2
                UpdatedAt = GETDATE()
            WHERE ObjectID = @ObjectID;
        END

        -- 6. Обновляем банковские реквизиты (ТОЛЬКО для этого заказа - из альтера 1)
        IF @CompanyID IS NOT NULL AND (@BankName IS NOT NULL OR @BankAccount IS NOT NULL OR @BankBIC IS NOT NULL)
        BEGIN
            IF EXISTS (SELECT 1 FROM CompanyBankDetails WHERE CompanyID = @CompanyID AND IsPrimary = 1)
                UPDATE CompanyBankDetails SET
                    BankName = ISNULL(@BankName, BankName),
                    BankAccount = ISNULL(@BankAccount, BankAccount),
                    BankBIC = ISNULL(@BankBIC, BankBIC)
                WHERE CompanyID = @CompanyID AND IsPrimary = 1;
            ELSE IF @BankName IS NOT NULL AND @BankAccount IS NOT NULL AND @BankBIC IS NOT NULL
                INSERT INTO CompanyBankDetails (CompanyID, BankName, BankAccount, BankBIC, IsPrimary, IsActive)
                VALUES (@CompanyID, @BankName, @BankAccount, @BankBIC, ISNULL(@BankIsPrimary, 1), 1);
        END

        -- 7. Обновляем детали договора
        SET @FinalCostWithoutVAT = ISNULL(@CostWithoutVAT, @CurrentCostWithoutVAT);
        SET @FinalVATRate = ISNULL(@VATRate, @CurrentVATRate);
        SET @FinalVATAmount = CASE WHEN @VATAmount IS NOT NULL THEN @VATAmount 
                                   ELSE ISNULL(@FinalCostWithoutVAT * @FinalVATRate / 100, @CurrentVATAmount) END;
        SET @FinalTotalCost = @FinalCostWithoutVAT + @FinalVATAmount;

        IF EXISTS (SELECT 1 FROM ContractDetails WHERE ContractID = @OrderID)
            UPDATE ContractDetails SET
                StartDate = ISNULL(@StartDate, StartDate),
                EndDate = ISNULL(@EndDate, EndDate),
                CostWithoutVAT = @FinalCostWithoutVAT,
                VATRate = @FinalVATRate,
                VATAmount = @FinalVATAmount,
                VATAmountWords = ISNULL(@VATAmountWords, VATAmountWords),
                TotalCostWords = ISNULL(@TotalCostWords, TotalCostWords),
                PaymentSchedule = ISNULL(@PaymentSchedule, PaymentSchedule)
            WHERE ContractID = @OrderID;
        ELSE IF @StartDate IS NOT NULL OR @EndDate IS NOT NULL OR @CostWithoutVAT IS NOT NULL
            INSERT INTO ContractDetails (ContractID, StartDate, EndDate, CostWithoutVAT, VATRate, VATAmount, TotalCostWords, PaymentSchedule)
            VALUES (@OrderID, ISNULL(@StartDate, GETDATE()), ISNULL(@EndDate, DATEADD(MONTH, 1, GETDATE())),
                    @FinalCostWithoutVAT, @FinalVATRate, @FinalVATAmount, @TotalCostWords, @PaymentSchedule);

        -- 8. Обновляем общую стоимость в Contracts
        UPDATE Contracts SET TotalCost = @FinalTotalCost WHERE ContractID = @OrderID;

        COMMIT TRANSACTION;
        
        -- Возвращаем обновлённые данные
        EXEC sp_GetOrderDetails @OrderID;
        
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END
GO

-- Добавление работы
CREATE PROCEDURE sp_AddOrderWork
    @OrderID          INT,
    @WorkTypeID       INT,
    @Quantity         DECIMAL(10,2),
    @UnitCost         DECIMAL(18,2),
    @Duration         INT,
    @ResponsibleUserID INT           = NULL,
    @Comment          NVARCHAR(MAX)  = NULL,
    @WorkID           INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @SortOrder INT;
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 10 FROM OrderWorks WHERE ContractID = @OrderID;
        INSERT INTO OrderWorks (ContractID, WorkTypeID, Quantity, UnitCost, Duration, ResponsibleUserID, Comment, Status, SortOrder, CreatedAt)
        VALUES (@OrderID, @WorkTypeID, @Quantity, @UnitCost, @Duration, @ResponsibleUserID, @Comment, 'Не начат', @SortOrder, GETDATE());
        SET @WorkID = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- Обновление работы
CREATE PROCEDURE sp_UpdateOrderWork
    @WorkID           INT,
    @WorkTypeID       INT           = NULL,
    @Quantity         DECIMAL(10,2) = NULL,
    @UnitCost         DECIMAL(18,2) = NULL,
    @Duration         INT           = NULL,
    @ResponsibleUserID INT          = NULL,
    @Status           NVARCHAR(50)  = NULL,
    @Comment          NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE OrderWorks SET
            WorkTypeID        = ISNULL(@WorkTypeID, WorkTypeID),
            Quantity          = ISNULL(@Quantity, Quantity),
            UnitCost          = ISNULL(@UnitCost, UnitCost),
            Duration          = ISNULL(@Duration, Duration),
            ResponsibleUserID = ISNULL(@ResponsibleUserID, ResponsibleUserID),
            Status            = ISNULL(@Status, Status),
            Comment           = ISNULL(@Comment, Comment),
            CompletedAt       = CASE WHEN @Status = 'Выполнен' AND Status != 'Выполнен' THEN GETDATE()
                                     WHEN @Status != 'Выполнен' THEN NULL
                                     ELSE CompletedAt END
        WHERE OrderWorkID = @WorkID;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- Удаление работы
CREATE PROCEDURE sp_DeleteOrderWork
    @WorkID INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @FilePaths TABLE (FilePath NVARCHAR(500));
        INSERT INTO @FilePaths (FilePath)
        SELECT FilePath FROM WorkFiles WHERE OrderWorkID = @WorkID;
        
        DELETE FROM WorkFiles WHERE OrderWorkID = @WorkID;
        DELETE FROM WorkComments WHERE OrderWorkID = @WorkID;
        DELETE FROM OrderWorks WHERE OrderWorkID = @WorkID;

        DECLARE @FilePath NVARCHAR(500);
        DECLARE file_cursor CURSOR FOR SELECT FilePath FROM @FilePaths;
        OPEN file_cursor;
        FETCH NEXT FROM file_cursor INTO @FilePath;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            FETCH NEXT FROM file_cursor INTO @FilePath;
        END;
        CLOSE file_cursor;
        DEALLOCATE file_cursor;
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- Статистика по заказам
CREATE PROCEDURE sp_GetOrdersStats
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT
        COUNT(*) AS TotalOrders,
        SUM(CASE WHEN Status = 'В работе'  THEN 1 ELSE 0 END) AS InProgressOrders,
        SUM(CASE WHEN Status = 'Завершена' THEN 1 ELSE 0 END) AS CompletedOrders,
        ISNULL(SUM(TotalCost), 0) AS TotalRevenue
    FROM vw_OrdersFull;
END
GO

-- Быстрое одобрение заявки
ALTER TABLE ClientCompanies ALTER COLUMN CompanyName NVARCHAR(200) NULL;
ALTER TABLE ClientCompanies ALTER COLUMN LegalAddress NVARCHAR(300) NULL;

ALTER TABLE ConstructionObjects ALTER COLUMN ObjectAddress NVARCHAR(300) NULL;
GO
CREATE OR ALTER PROCEDURE sp_QuickApproveApplication
    @ApplicationID     INT,
    @UserID            INT,
    @SendEmail         BIT           = 1,
    @OrderID           INT OUTPUT,
    @ClientEmail       NVARCHAR(150) OUTPUT,
    @ClientName        NVARCHAR(200) OUTPUT,
    @TemporaryPassword NVARCHAR(50)  OUTPUT,
    @IsNewUser         BIT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        DECLARE @GuestName NVARCHAR(200), @GuestPhone NVARCHAR(20), @GuestEmail NVARCHAR(150), @ClientUserID INT;
        DECLARE @ObjectTypeID INT;
        DECLARE @PasswordChars VARCHAR(62) = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        DECLARE @Counter INT, @PasswordLength INT = 8;

        SELECT 
            @GuestName = GuestName, 
            @GuestPhone = GuestPhone, 
            @GuestEmail = GuestEmail,
            @ObjectTypeID = ObjectTypeID
        FROM Applications 
        WHERE ApplicationID = @ApplicationID;

        IF @ObjectTypeID IS NULL
            SELECT TOP 1 @ObjectTypeID = ObjectTypeID FROM ObjectTypes WHERE IsActive = 1 ORDER BY SortOrder;

        IF @GuestEmail IS NOT NULL AND @GuestEmail != ''
            SELECT @ClientUserID = UserID FROM Users WHERE Email = @GuestEmail;

        IF @ClientUserID IS NULL AND @GuestEmail IS NOT NULL AND @GuestEmail != ''
        BEGIN
            SET @Counter = 0; SET @TemporaryPassword = '';
            WHILE @Counter < @PasswordLength
            BEGIN
                SET @TemporaryPassword = @TemporaryPassword + SUBSTRING(@PasswordChars, 1 + (ABS(CHECKSUM(NEWID())) % 62), 1);
                SET @Counter = @Counter + 1;
            END
            DECLARE @PasswordHash NVARCHAR(255) = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_256', @TemporaryPassword), 2);
            INSERT INTO Users (Login, PasswordHash, FullName, Email, Phone, Role, IsActive, CreatedAt)
            VALUES (@GuestEmail, @PasswordHash, @GuestName, @GuestEmail, @GuestPhone, 'client', 1, GETDATE());
            SET @ClientUserID = SCOPE_IDENTITY();
            SET @IsNewUser = 1;
        END
        ELSE IF @ClientUserID IS NOT NULL
        BEGIN
            SET @Counter = 0; SET @TemporaryPassword = '';
            WHILE @Counter < @PasswordLength
            BEGIN
                SET @TemporaryPassword = @TemporaryPassword + SUBSTRING(@PasswordChars, 1 + (ABS(CHECKSUM(NEWID())) % 62), 1);
                SET @Counter = @Counter + 1;
            END
            SET @IsNewUser = 0;
        END

        UPDATE Applications 
        SET 
            Status = 'В работе',        -- ← исправлено с 'Одобрена'
            ClientUserID = @ClientUserID,
            SpecialistID = @UserID,
            ObjectTypeID = @ObjectTypeID,
            UpdatedAt = GETDATE()
        WHERE ApplicationID = @ApplicationID;

        DECLARE @CompanyID INT;
        INSERT INTO ClientCompanies (
            UserID, 
            CompanyName,         -- ← пусто, менеджер заполнит сам
            UNP, 
            OKPO, 
            LegalAddress,
            DirectorLastName,
            DirectorFirstName,
            DirectorPatronymic,
            DirectorPosition,
            AuthorityDoc,
            CreatedAt
        )
        VALUES (
            @ClientUserID,
            NULL,               -- ← было: @GuestName + ' (заказ от ...)'
            NULL,
            NULL,
            NULL,               -- ← было: 'Не указан'
            NULL,
            NULL,
            NULL,
            NULL,               -- ← было: 'Директор'
            'Устава',
            GETDATE()
        );
        SET @CompanyID = SCOPE_IDENTITY();

        DECLARE @ObjectID INT;
        INSERT INTO ConstructionObjects (
            ClientUserID, 
            ObjectName,          -- ← пусто, менеджер заполнит сам
            ObjectAddress, 
            ObjectTypeID,
            Description,
            CreatedAt
        )
        VALUES (
            @ClientUserID,
            NULL,               -- ← было: 'Объект по заявке №...'
            NULL,               -- ← было: 'Не указан'
            @ObjectTypeID,
            NULL,               -- ← убрали имя гостя как описание
            GETDATE()
        );
        SET @ObjectID = SCOPE_IDENTITY();

        DECLARE @ContractNumber NVARCHAR(50) =
            'ДОГ-' + CONVERT(NVARCHAR(4), YEAR(GETDATE())) + '-' +
            RIGHT('00' + CONVERT(NVARCHAR(2), MONTH(GETDATE())), 2) + '-' +
            RIGHT('0000' + CONVERT(NVARCHAR(4), @ApplicationID), 4);

        INSERT INTO Contracts (
            ApplicationID, 
            CompanyID, 
            ObjectID, 
            ContractNumber, 
            SignDate, 
            City, 
            TotalCost,
            ObjectTypeID,
            CreatedAt
        )
        VALUES (
            @ApplicationID, 
            @CompanyID, 
            @ObjectID, 
            @ContractNumber, 
            GETDATE(), 
            'г. Минск', 
            0,
            @ObjectTypeID,
            GETDATE()
        );
        SET @OrderID = SCOPE_IDENTITY();

        INSERT INTO ContractDetails (ContractID, StartDate, EndDate, CostWithoutVAT, VATRate, VATAmount, PaymentSchedule)
        VALUES (@OrderID, GETDATE(), DATEADD(month, 1, GETDATE()), 0, 20, 0, 'Оплата по договору');

        SELECT @ClientEmail = @GuestEmail, @ClientName = @GuestName;
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
GO

-- Генерация договора
CREATE OR ALTER PROCEDURE dbo.sp_GenerateContract
    @ContractID   INT,
    @IncludeWorks BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT
        c.ContractID, c.ContractNumber, c.SignDate, c.City, c.TotalCost,
        cc.CompanyName, cc.UNP, cc.OKPO, cc.LegalAddress,
        cc.DirectorLastName, cc.DirectorFirstName, cc.DirectorPatronymic,
        cc.DirectorPosition, cc.AuthorityDoc,
        CONCAT_WS(' ', cc.DirectorLastName, cc.DirectorFirstName, cc.DirectorPatronymic) AS DirectorName,
        u.Email AS ClientEmail, u.Phone AS ClientPhone,
        bd.BankName AS ClientBankName, bd.BankAccount AS ClientBank, bd.BankBIC AS ClientBankBIC,
        co.ObjectName, co.ObjectAddress, ot.TypeName AS ObjectTypeName,
        cd.StartDate, cd.EndDate, cd.CostWithoutVAT, cd.VATRate, cd.VATAmount,
        cd.TotalCostWords, cd.VATAmountWords, cd.PaymentSchedule,
        fn.ContractText
    FROM dbo.Contracts c
    JOIN dbo.ClientCompanies cc      ON c.CompanyID     = cc.CompanyID
    JOIN dbo.Users u                 ON cc.UserID       = u.UserID
    JOIN dbo.ConstructionObjects co  ON c.ObjectID      = co.ObjectID
    JOIN dbo.Applications a          ON c.ApplicationID = a.ApplicationID
    LEFT JOIN dbo.ObjectTypes ot     ON co.ObjectTypeID = ot.ObjectTypeID
    LEFT JOIN dbo.ContractDetails cd ON c.ContractID    = cd.ContractID
    LEFT JOIN dbo.CompanyBankDetails bd ON cc.CompanyID = bd.CompanyID AND bd.IsPrimary = 1
    CROSS APPLY (SELECT dbo.fn_GenerateContractText(c.ContractID) AS ContractText) fn
    WHERE c.ContractID = @ContractID;

    IF @IncludeWorks = 1
        SELECT ow.OrderWorkID, wt.WorkName, ow.Quantity, ow.UnitCost,
               ow.Quantity * ow.UnitCost AS TotalCost, ow.Duration, ow.Status, ow.Comment
        FROM dbo.OrderWorks ow
        JOIN dbo.WorkTypes wt ON ow.WorkTypeID = wt.WorkTypeID
        WHERE ow.ContractID = @ContractID
        ORDER BY ow.SortOrder;
END;
GO

-- Проекты
CREATE OR ALTER PROCEDURE sp_GetProjects
    @Page     INT           = 1,
    @PageSize INT           = 10,
    @Search   NVARCHAR(100) = '',
    @Category NVARCHAR(100) = '',
    @Status   NVARCHAR(50)  = '',
    @ShowAll  BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;

    SELECT Id, Title, ShortDescription, Description, Category, Location, Area, Year,
           Status, MainImage, Features, CreatedAt, UpdatedAt, IsPublished, SortOrder
    FROM Projects
    WHERE (@Search   = '' OR Title LIKE '%' + @Search + '%' OR Description LIKE '%' + @Search + '%' OR ShortDescription LIKE '%' + @Search + '%')
      AND (@Category = '' OR Category = @Category)
      AND (@Status   = '' OR Status   = @Status)
      AND (@ShowAll  = 1  OR IsPublished = 1)
    ORDER BY CASE WHEN @ShowAll = 1 THEN SortOrder ELSE 0 END,
             CASE WHEN @ShowAll = 1 THEN CreatedAt  END DESC,
             CreatedAt DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(*) AS TotalCount FROM Projects
    WHERE (@Search   = '' OR Title LIKE '%' + @Search + '%' OR Description LIKE '%' + @Search + '%' OR ShortDescription LIKE '%' + @Search + '%')
      AND (@Category = '' OR Category = @Category)
      AND (@Status   = '' OR Status   = @Status)
      AND (@ShowAll  = 1  OR IsPublished = 1);

    SELECT DISTINCT Category FROM Projects WHERE Category IS NOT NULL AND Category != '' ORDER BY Category;
END
GO

CREATE OR ALTER PROCEDURE sp_GetProjectById
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id, Title, ShortDescription, Description, Category, Location, Area, Year,
           Status, MainImage, Features, CreatedAt, UpdatedAt, IsPublished, SortOrder
    FROM Projects WHERE Id = @Id;
    SELECT ImageID, FileName, SortOrder FROM ProjectImages WHERE ProjectID = @Id ORDER BY SortOrder;
END
GO

CREATE OR ALTER PROCEDURE sp_SaveProject
    @Id              INT           = NULL,
    @Title           NVARCHAR(200),
    @Description     NVARCHAR(MAX) = NULL,
    @ShortDescription NVARCHAR(500) = NULL,
    @Category        NVARCHAR(100),
    @Location        NVARCHAR(200) = NULL,
    @Area            DECIMAL(10,2) = NULL,
    @Year            INT           = NULL,
    @Status          NVARCHAR(50)  = NULL,
    @MainImage       NVARCHAR(255) = NULL,
    @Features        NVARCHAR(MAX) = NULL,
    @IsPublished     BIT           = 1,
    @SortOrder       INT           = 0,
    @NewId           INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF @Id IS NULL OR @Id = 0
    BEGIN
        INSERT INTO Projects (Title, Description, ShortDescription, Category, Location, Area, Year, Status, MainImage, Features, IsPublished, SortOrder, CreatedAt, UpdatedAt)
        VALUES (@Title, @Description, @ShortDescription, @Category, @Location, @Area, @Year, @Status, @MainImage, @Features, @IsPublished, @SortOrder, GETDATE(), GETDATE());
        SET @NewId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE Projects SET
            Title            = @Title,
            Description      = @Description,
            ShortDescription = @ShortDescription,
            Category         = @Category,
            Location         = @Location,
            Area             = @Area,
            Year             = @Year,
            Status           = @Status,
            MainImage        = ISNULL(@MainImage, MainImage),
            Features         = @Features,
            IsPublished      = @IsPublished,
            SortOrder        = @SortOrder,
            UpdatedAt        = GETDATE()
        WHERE Id = @Id;
        SET @NewId = @Id;
    END
END
GO

CREATE OR ALTER PROCEDURE sp_DeleteProject @Id INT
AS BEGIN SET NOCOUNT ON; DELETE FROM Projects WHERE Id = @Id; END
GO

CREATE OR ALTER PROCEDURE sp_ToggleProjectPublish @Id INT, @IsPublished BIT
AS BEGIN SET NOCOUNT ON; UPDATE Projects SET IsPublished = @IsPublished, UpdatedAt = GETDATE() WHERE Id = @Id; END
GO

CREATE OR ALTER PROCEDURE sp_UpdateProjectSortOrder @Id INT, @SortOrder INT
AS BEGIN SET NOCOUNT ON; UPDATE Projects SET SortOrder = @SortOrder, UpdatedAt = GETDATE() WHERE Id = @Id; END
GO

CREATE OR ALTER PROCEDURE sp_GetProjectImages @ProjectID INT
AS BEGIN SET NOCOUNT ON; SELECT ImageID, FileName, SortOrder FROM ProjectImages WHERE ProjectID = @ProjectID ORDER BY SortOrder; END
GO

CREATE OR ALTER PROCEDURE sp_AddProjectImage
    @ProjectID INT, @FileName NVARCHAR(255), @SortOrder INT = 0, @NewImageID INT OUTPUT
AS BEGIN
    SET NOCOUNT ON;
    INSERT INTO ProjectImages (ProjectID, FileName, SortOrder) VALUES (@ProjectID, @FileName, @SortOrder);
    SET @NewImageID = SCOPE_IDENTITY();
END
GO

CREATE OR ALTER PROCEDURE sp_DeleteProjectImage
    @ImageID INT, @FileName NVARCHAR(255) OUTPUT
AS BEGIN
    SET NOCOUNT ON;
    SELECT @FileName = FileName FROM ProjectImages WHERE ImageID = @ImageID;
    DELETE FROM ProjectImages WHERE ImageID = @ImageID;
END
GO

CREATE OR ALTER PROCEDURE sp_UpdateProjectImageOrder @ImageID INT, @SortOrder INT
AS BEGIN SET NOCOUNT ON; UPDATE ProjectImages SET SortOrder = @SortOrder WHERE ImageID = @ImageID; END
GO

-- Специалисты
CREATE PROCEDURE sp_GetSpecialists
    @Page         INT           = 1,
    @PageSize     INT           = 10,
    @Search       NVARCHAR(100) = '',
    @ShowInactive BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    SELECT UserID, Login, FullName, Email, Phone, Role, IsActive, CreatedAt, LastLoginAt
    FROM Users
    WHERE Role IN ('specialist', 'admin')
      AND (@Search = '' OR FullName LIKE '%' + @Search + '%' OR Email LIKE '%' + @Search + '%' OR Login LIKE '%' + @Search + '%')
      AND (@ShowInactive = 1 OR IsActive = 1)
    ORDER BY CASE WHEN Role = 'admin' THEN 1 ELSE 2 END, FullName
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(*) AS TotalCount FROM Users
    WHERE Role IN ('specialist', 'admin')
      AND (@Search = '' OR FullName LIKE '%' + @Search + '%' OR Email LIKE '%' + @Search + '%' OR Login LIKE '%' + @Search + '%')
      AND (@ShowInactive = 1 OR IsActive = 1);
END
GO

CREATE PROCEDURE sp_GetSpecialistById @UserID INT
AS BEGIN
    SET NOCOUNT ON;
    SELECT UserID, Login, FullName, Email, Phone, Role, IsActive, CreatedAt, LastLoginAt
    FROM Users WHERE UserID = @UserID AND Role IN ('specialist', 'admin');
END
GO

CREATE PROCEDURE sp_CreateSpecialist
    @Login      NVARCHAR(100),
    @PasswordHash NVARCHAR(255),
    @FullName   NVARCHAR(200),
    @Email      NVARCHAR(150),
    @Phone      NVARCHAR(20)  = NULL,
    @Role       NVARCHAR(20)  = 'specialist',
    @IsActive   BIT           = 1,
    @NewUserID  INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF EXISTS (SELECT 1 FROM Users WHERE Login = @Login)
        BEGIN RAISERROR('Пользователь с таким логином уже существует', 16, 1); RETURN; END
        IF EXISTS (SELECT 1 FROM Users WHERE Email = @Email)
        BEGIN RAISERROR('Пользователь с таким email уже существует', 16, 1); RETURN; END
        INSERT INTO Users (Role, Login, PasswordHash, FullName, Email, Phone, IsActive, CreatedAt)
        VALUES (@Role, @Login, @PasswordHash, @FullName, @Email, @Phone, @IsActive, GETDATE());
        SET @NewUserID = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

CREATE PROCEDURE sp_UpdateSpecialist
    @UserID   INT, @FullName NVARCHAR(200), @Email NVARCHAR(150),
    @Phone    NVARCHAR(20) = NULL, @Role NVARCHAR(20), @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF EXISTS (SELECT 1 FROM Users WHERE Email = @Email AND UserID != @UserID)
        BEGIN RAISERROR('Пользователь с таким email уже существует', 16, 1); RETURN; END
        UPDATE Users SET FullName = @FullName, Email = @Email, Phone = @Phone, Role = @Role, IsActive = @IsActive
        WHERE UserID = @UserID;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

CREATE PROCEDURE sp_ChangeSpecialistPassword @UserID INT, @PasswordHash NVARCHAR(255)
AS BEGIN SET NOCOUNT ON; UPDATE Users SET PasswordHash = @PasswordHash WHERE UserID = @UserID; END
GO

CREATE PROCEDURE sp_DeleteSpecialist @UserID INT, @HardDelete BIT = 0
AS BEGIN
    SET NOCOUNT ON;
    IF @HardDelete = 1 DELETE FROM Users WHERE UserID = @UserID;
    ELSE UPDATE Users SET IsActive = 0 WHERE UserID = @UserID;
END
GO

CREATE PROCEDURE sp_GetSpecialistsStats
AS BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(*) AS TotalSpecialists,
           SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS ActiveSpecialists,
           SUM(CASE WHEN Role = 'admin' THEN 1 ELSE 0 END) AS Admins,
           SUM(CASE WHEN Role = 'specialist' AND IsActive = 1 THEN 1 ELSE 0 END) AS ActiveSpecialistsCount
    FROM Users WHERE Role IN ('specialist', 'admin');
END
GO

CREATE PROCEDURE sp_UpdateLastLogin @UserID INT
AS BEGIN SET NOCOUNT ON; UPDATE Users SET LastLoginAt = GETDATE() WHERE UserID = @UserID; END
GO

-- История специалиста
CREATE OR ALTER PROCEDURE sp_AddHistoryEntry
    @SpecialistID INT, @ActionType NVARCHAR(50),
    @ApplicationID INT = NULL, @OrderID INT = NULL, @ClientID INT = NULL,
    @Description NVARCHAR(500) = NULL, @Details NVARCHAR(MAX) = NULL
AS BEGIN
    INSERT INTO SpecialistHistory (SpecialistID, ActionType, ActionDate, ApplicationID, OrderID, ClientID, Description, Details)
    VALUES (@SpecialistID, @ActionType, GETDATE(), @ApplicationID, @OrderID, @ClientID, @Description, @Details);
END
GO

CREATE OR ALTER PROCEDURE sp_GetSpecialistHistory
    @SpecialistID INT, @Page INT = 1, @PageSize INT = 20,
    @ActionType NVARCHAR(50) = NULL, @DateFrom DATE = NULL, @DateTo DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    SELECT h.HistoryID, h.ActionType, h.ActionDate, h.Description, h.Details,
           h.ApplicationID, h.OrderID, h.ClientID,
           a.GuestName AS ClientName, a.GuestPhone AS ClientPhone, a.GuestEmail AS ClientEmail,
           c.ContractNumber AS OrderNumber
    FROM SpecialistHistory h
    LEFT JOIN Applications a ON h.ApplicationID = a.ApplicationID
    LEFT JOIN Contracts c    ON h.OrderID       = c.ContractID
    WHERE h.SpecialistID = @SpecialistID
      AND (@ActionType IS NULL OR h.ActionType = @ActionType)
      AND (@DateFrom IS NULL OR CAST(h.ActionDate AS DATE) >= @DateFrom)
      AND (@DateTo   IS NULL OR CAST(h.ActionDate AS DATE) <= @DateTo)
    ORDER BY h.ActionDate DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(*) AS TotalCount FROM SpecialistHistory
    WHERE SpecialistID = @SpecialistID
      AND (@ActionType IS NULL OR ActionType = @ActionType)
      AND (@DateFrom IS NULL OR CAST(ActionDate AS DATE) >= @DateFrom)
      AND (@DateTo   IS NULL OR CAST(ActionDate AS DATE) <= @DateTo);
END
GO

CREATE OR ALTER PROCEDURE sp_GetSpecialistStats @SpecialistID INT
AS BEGIN
    SET NOCOUNT ON;
    SELECT
        COUNT(DISTINCT a.ApplicationID) AS TotalApplications,
        COUNT(DISTINCT CASE WHEN a.Status = 'Завершена' THEN a.ApplicationID END) AS CompletedApplications,
        COUNT(DISTINCT c.ContractID) AS TotalOrders,
        SUM(CASE WHEN c.TotalCost IS NOT NULL THEN c.TotalCost ELSE 0 END) AS TotalRevenue,
        COUNT(DISTINCT a.ClientUserID) AS TotalClients
    FROM Users u
    LEFT JOIN Applications a ON u.UserID = a.SpecialistID
    LEFT JOIN Contracts c    ON a.ApplicationID = c.ApplicationID
    WHERE u.UserID = @SpecialistID;
END
GO

-- Отчеты
CREATE OR ALTER PROCEDURE sp_Report_ClientsByPeriod
    @DateFrom DATE, @DateTo DATE, @GroupBy NVARCHAR(20) = 'month'
AS
BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(DISTINCT u.UserID) AS TotalClients,
           COUNT(DISTINCT CASE WHEN u.CreatedAt >= @DateFrom AND u.CreatedAt <= @DateTo THEN u.UserID END) AS NewClients,
           COUNT(DISTINCT a.ApplicationID) AS TotalApplications,
           COUNT(DISTINCT c.ContractID) AS TotalOrders,
           ISNULL(SUM(c.TotalCost), 0) AS TotalRevenue
    FROM Users u
    LEFT JOIN Applications a ON u.UserID = a.ClientUserID
    LEFT JOIN Contracts c    ON a.ApplicationID = c.ApplicationID
    WHERE u.Role = 'client' AND (@DateFrom IS NULL OR u.CreatedAt >= @DateFrom) AND (@DateTo IS NULL OR u.CreatedAt <= @DateTo);

    IF @GroupBy = 'day'
        SELECT CAST(u.CreatedAt AS DATE) AS Period, COUNT(DISTINCT u.UserID) AS NewClients,
               COUNT(DISTINCT a.ApplicationID) AS Applications, COUNT(DISTINCT c.ContractID) AS Orders,
               ISNULL(SUM(c.TotalCost), 0) AS Revenue
        FROM Users u LEFT JOIN Applications a ON u.UserID = a.ClientUserID LEFT JOIN Contracts c ON a.ApplicationID = c.ApplicationID
        WHERE u.Role = 'client' AND u.CreatedAt BETWEEN @DateFrom AND @DateTo
        GROUP BY CAST(u.CreatedAt AS DATE) ORDER BY Period;
    ELSE IF @GroupBy = 'month'
        SELECT YEAR(u.CreatedAt) AS Year, MONTH(u.CreatedAt) AS Month, DATENAME(month, u.CreatedAt) AS MonthName,
               COUNT(DISTINCT u.UserID) AS NewClients, COUNT(DISTINCT a.ApplicationID) AS Applications,
               COUNT(DISTINCT c.ContractID) AS Orders, ISNULL(SUM(c.TotalCost), 0) AS Revenue
        FROM Users u LEFT JOIN Applications a ON u.UserID = a.ClientUserID LEFT JOIN Contracts c ON a.ApplicationID = c.ApplicationID
        WHERE u.Role = 'client' AND u.CreatedAt BETWEEN @DateFrom AND @DateTo
        GROUP BY YEAR(u.CreatedAt), MONTH(u.CreatedAt), DATENAME(month, u.CreatedAt) ORDER BY Year, Month;
    ELSE IF @GroupBy = 'year'
        SELECT YEAR(u.CreatedAt) AS Year, COUNT(DISTINCT u.UserID) AS NewClients,
               COUNT(DISTINCT a.ApplicationID) AS Applications, COUNT(DISTINCT c.ContractID) AS Orders,
               ISNULL(SUM(c.TotalCost), 0) AS Revenue
        FROM Users u LEFT JOIN Applications a ON u.UserID = a.ClientUserID LEFT JOIN Contracts c ON a.ApplicationID = c.ApplicationID
        WHERE u.Role = 'client' AND u.CreatedAt BETWEEN @DateFrom AND @DateTo
        GROUP BY YEAR(u.CreatedAt) ORDER BY Year;

    SELECT TOP 10 u.UserID, u.FullName, u.Email, u.Phone,
           COUNT(DISTINCT c.ContractID) AS OrdersCount, ISNULL(SUM(c.TotalCost), 0) AS TotalSpent,
           MAX(c.SignDate) AS LastOrderDate
    FROM Users u LEFT JOIN Applications a ON u.UserID = a.ClientUserID LEFT JOIN Contracts c ON a.ApplicationID = c.ApplicationID
    WHERE u.Role = 'client' AND (c.SignDate IS NULL OR c.SignDate BETWEEN @DateFrom AND @DateTo)
    GROUP BY u.UserID, u.FullName, u.Email, u.Phone ORDER BY TotalSpent DESC;
END
GO

CREATE OR ALTER PROCEDURE sp_Report_OrdersByPeriod
    @DateFrom DATE, @DateTo DATE, @GroupBy NVARCHAR(20) = 'month', @Status NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(DISTINCT c.ContractID) AS TotalOrders,
           COUNT(DISTINCT CASE WHEN a.Status = 'Завершена' THEN c.ContractID END) AS CompletedOrders,
           COUNT(DISTINCT CASE WHEN a.Status = 'В работе'  THEN c.ContractID END) AS InProgressOrders,
           COUNT(DISTINCT CASE WHEN a.Status = 'Новая'     THEN c.ContractID END) AS NewOrders,
           ISNULL(SUM(c.TotalCost), 0) AS TotalRevenue, AVG(c.TotalCost) AS AverageOrderValue,
           COUNT(DISTINCT a.ClientUserID) AS UniqueClients
    FROM Contracts c JOIN Applications a ON c.ApplicationID = a.ApplicationID
    WHERE c.SignDate BETWEEN @DateFrom AND @DateTo AND (@Status IS NULL OR a.Status = @Status);

    IF @GroupBy = 'day'
        SELECT CAST(c.SignDate AS DATE) AS Period, COUNT(DISTINCT c.ContractID) AS OrdersCount,
               COUNT(DISTINCT CASE WHEN a.Status = 'Завершена' THEN c.ContractID END) AS CompletedCount,
               ISNULL(SUM(c.TotalCost), 0) AS Revenue, COUNT(DISTINCT a.ClientUserID) AS ClientsCount
        FROM Contracts c JOIN Applications a ON c.ApplicationID = a.ApplicationID
        WHERE c.SignDate BETWEEN @DateFrom AND @DateTo AND (@Status IS NULL OR a.Status = @Status)
        GROUP BY CAST(c.SignDate AS DATE) ORDER BY Period;
    ELSE IF @GroupBy = 'month'
        SELECT YEAR(c.SignDate) AS Year, MONTH(c.SignDate) AS Month, DATENAME(month, c.SignDate) AS MonthName,
               COUNT(DISTINCT c.ContractID) AS OrdersCount,
               COUNT(DISTINCT CASE WHEN a.Status = 'Завершена' THEN c.ContractID END) AS CompletedCount,
               ISNULL(SUM(c.TotalCost), 0) AS Revenue, COUNT(DISTINCT a.ClientUserID) AS ClientsCount
        FROM Contracts c JOIN Applications a ON c.ApplicationID = a.ApplicationID
        WHERE c.SignDate BETWEEN @DateFrom AND @DateTo AND (@Status IS NULL OR a.Status = @Status)
        GROUP BY YEAR(c.SignDate), MONTH(c.SignDate), DATENAME(month, c.SignDate) ORDER BY Year, Month;
    ELSE IF @GroupBy = 'year'
        SELECT YEAR(c.SignDate) AS Year, COUNT(DISTINCT c.ContractID) AS OrdersCount,
               COUNT(DISTINCT CASE WHEN a.Status = 'Завершена' THEN c.ContractID END) AS CompletedCount,
               ISNULL(SUM(c.TotalCost), 0) AS Revenue, COUNT(DISTINCT a.ClientUserID) AS ClientsCount
        FROM Contracts c JOIN Applications a ON c.ApplicationID = a.ApplicationID
        WHERE c.SignDate BETWEEN @DateFrom AND @DateTo AND (@Status IS NULL OR a.Status = @Status)
        GROUP BY YEAR(c.SignDate) ORDER BY Year;
END
GO

CREATE OR ALTER PROCEDURE sp_Report_OrdersByParams
    @DateFrom DATE = NULL, @DateTo DATE = NULL, @Status NVARCHAR(50) = NULL,
    @SpecialistID INT = NULL, @Category NVARCHAR(100) = NULL,
    @MinAmount DECIMAL(18,2) = NULL, @MaxAmount DECIMAL(18,2) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.ContractID, c.ContractNumber, c.SignDate, c.TotalCost, a.Status,
           a.CreatedAt AS ApplicationDate, u.FullName AS ClientName, u.Email AS ClientEmail, u.Phone AS ClientPhone,
           s.FullName AS SpecialistName, co.ObjectName, co.ObjectAddress, ot.TypeName AS ObjectType,
           cc.CompanyName, cc.UNP
    FROM Contracts c
    JOIN Applications a           ON c.ApplicationID = a.ApplicationID
    JOIN Users u                  ON a.ClientUserID  = u.UserID
    LEFT JOIN Users s             ON a.SpecialistID  = s.UserID
    JOIN ConstructionObjects co   ON c.ObjectID      = co.ObjectID
    LEFT JOIN ObjectTypes ot      ON co.ObjectTypeID = ot.ObjectTypeID
    LEFT JOIN ClientCompanies cc  ON u.UserID        = cc.UserID
    WHERE (@DateFrom IS NULL OR c.SignDate >= @DateFrom)
      AND (@DateTo   IS NULL OR c.SignDate <= @DateTo)
      AND (@Status   IS NULL OR a.Status   = @Status)
      AND (@SpecialistID IS NULL OR a.SpecialistID = @SpecialistID)
      AND (@Category IS NULL OR ot.TypeName = @Category)
      AND (@MinAmount IS NULL OR c.TotalCost >= @MinAmount)
      AND (@MaxAmount IS NULL OR c.TotalCost <= @MaxAmount)
    ORDER BY c.SignDate DESC;
END
GO

CREATE OR ALTER PROCEDURE sp_Report_ApplicationStatus
    @DateFrom DATE = NULL, @DateTo DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.Status, COUNT(*) AS Count,
           COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS Percentage
    FROM Applications a
    WHERE (@DateFrom IS NULL OR a.CreatedAt >= @DateFrom) AND (@DateTo IS NULL OR a.CreatedAt <= @DateTo)
    GROUP BY a.Status ORDER BY Count DESC;

    SELECT YEAR(a.CreatedAt) AS Year, MONTH(a.CreatedAt) AS Month, DATENAME(month, a.CreatedAt) AS MonthName,
           a.Status, COUNT(*) AS Count
    FROM Applications a
    WHERE (@DateFrom IS NULL OR a.CreatedAt >= @DateFrom) AND (@DateTo IS NULL OR a.CreatedAt <= @DateTo)
    GROUP BY YEAR(a.CreatedAt), MONTH(a.CreatedAt), DATENAME(month, a.CreatedAt), a.Status
    ORDER BY Year, Month, Status;
END
GO

CREATE OR ALTER PROCEDURE sp_Report_SpecialistPerformance
    @DateFrom DATE = NULL, @DateTo DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserID, u.FullName, u.Email,
           COUNT(DISTINCT a.ApplicationID) AS TotalApplications,
           COUNT(DISTINCT CASE WHEN a.Status = 'Завершена' THEN a.ApplicationID END) AS CompletedApplications,
           COUNT(DISTINCT CASE WHEN a.Status = 'В работе'  THEN a.ApplicationID END) AS InProgressApplications,
           COUNT(DISTINCT c.ContractID) AS TotalOrders,
           ISNULL(SUM(c.TotalCost), 0) AS TotalRevenue, AVG(c.TotalCost) AS AverageOrderValue,
           COUNT(DISTINCT a.ClientUserID) AS UniqueClients
    FROM Users u
    LEFT JOIN Applications a ON u.UserID = a.SpecialistID
    LEFT JOIN Contracts c    ON a.ApplicationID = c.ApplicationID
    WHERE u.Role IN ('specialist', 'admin')
      AND (@DateFrom IS NULL OR a.CreatedAt >= @DateFrom)
      AND (@DateTo   IS NULL OR a.CreatedAt <= @DateTo)
    GROUP BY u.UserID, u.FullName, u.Email ORDER BY TotalRevenue DESC;
END
GO

-- Рекомендованные работы (без Services)
CREATE OR ALTER PROCEDURE sp_GetRecommendedWorks
    @ObjectTypeID INT, @ObjectArea DECIMAL(10,2) = 0, @ObjectFloors INT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SELECT wt.WorkTypeID, wt.WorkName, wt.DefaultDuration,
           req.InclusionRule, req.DurationMultiplier, req.IsRequired, req.SortOrder,
           CASE
               WHEN req.InclusionRule = 'area_based' THEN CEILING(wt.DefaultDuration * req.DurationMultiplier * (@ObjectArea / 100))
               WHEN req.InclusionRule = 'per_floor'  THEN wt.DefaultDuration * @ObjectFloors * req.DurationMultiplier
               ELSE CEILING(wt.DefaultDuration * req.DurationMultiplier)
           END AS RecommendedDuration,
           CASE req.InclusionRule
               WHEN 'always'     THEN 'Обязательная работа'
               WHEN 'area_based' THEN 'Зависит от площади'
               WHEN 'per_floor'  THEN 'На каждый этаж'
               WHEN 'optional'   THEN 'Опционально'
               ELSE ''
           END AS RuleDescription
    FROM ObjectTypeWorkRequirements req
    JOIN WorkTypes wt ON req.WorkTypeID = wt.WorkTypeID
    WHERE req.ObjectTypeID = @ObjectTypeID
    ORDER BY req.SortOrder;
END
GO

-- Комментарии к работам
CREATE PROCEDURE sp_GetWorkComments
    @OrderWorkID INT, @ClientView BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT wc.CommentID, wc.OrderWorkID, wc.CommentText, wc.IsVisibleToClient, wc.CreatedAt, wc.UpdatedAt,
           u.UserID AS AuthorID, u.FullName AS AuthorName, u.Role AS AuthorRole
    FROM WorkComments wc
    JOIN Users u ON wc.AuthorID = u.UserID
    WHERE wc.OrderWorkID = @OrderWorkID AND (@ClientView = 0 OR wc.IsVisibleToClient = 1)
    ORDER BY wc.CreatedAt ASC;
END
GO

CREATE PROCEDURE sp_AddWorkComment
    @OrderWorkID INT, @AuthorID INT, @CommentText NVARCHAR(MAX),
    @IsVisibleToClient BIT = 1, @CommentID INT OUTPUT
AS BEGIN
    SET NOCOUNT ON;
    INSERT INTO WorkComments (OrderWorkID, AuthorID, CommentText, IsVisibleToClient, CreatedAt)
    VALUES (@OrderWorkID, @AuthorID, @CommentText, @IsVisibleToClient, GETDATE());
    SET @CommentID = SCOPE_IDENTITY();
END
GO

CREATE PROCEDURE sp_DeleteWorkComment @CommentID INT, @AuthorID INT
AS BEGIN
    SET NOCOUNT ON;
    DELETE FROM WorkComments WHERE CommentID = @CommentID
      AND (AuthorID = @AuthorID OR EXISTS (SELECT 1 FROM Users WHERE UserID = @AuthorID AND Role = 'admin'));
END
GO

-- Файлы к работам
CREATE PROCEDURE sp_GetWorkFiles @OrderWorkID INT
AS BEGIN
    SET NOCOUNT ON;
    SELECT wf.FileID, wf.OrderWorkID, wf.FileName, wf.FilePath, wf.Description, wf.FileSize, wf.MimeType,
           wf.UploadedAt, u.FullName AS UploaderName, u.Role AS UploaderRole
    FROM WorkFiles wf JOIN Users u ON wf.UploadedBy = u.UserID
    WHERE wf.OrderWorkID = @OrderWorkID ORDER BY wf.UploadedAt DESC;
END
GO

CREATE PROCEDURE sp_AddWorkFile
    @OrderWorkID INT, @FileName NVARCHAR(255), @FilePath NVARCHAR(500),
    @Description NVARCHAR(500) = NULL, @FileSize BIGINT = NULL, @MimeType NVARCHAR(100) = NULL,
    @UploadedBy INT, @FileID INT OUTPUT
AS BEGIN
    SET NOCOUNT ON;
    INSERT INTO WorkFiles (OrderWorkID, FileName, FilePath, Description, FileSize, MimeType, UploadedBy, UploadedAt)
    VALUES (@OrderWorkID, @FileName, @FilePath, @Description, @FileSize, @MimeType, @UploadedBy, GETDATE());
    SET @FileID = SCOPE_IDENTITY();
END
GO

CREATE PROCEDURE sp_DeleteWorkFile @FileID INT, @FilePath NVARCHAR(500) OUTPUT
AS BEGIN
    SET NOCOUNT ON;
    SELECT @FilePath = FilePath FROM WorkFiles WHERE FileID = @FileID;
    DELETE FROM WorkFiles WHERE FileID = @FileID;
END
GO

-- Детали работы (без Services)
CREATE PROCEDURE sp_GetWorkDetails @OrderWorkID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ow.OrderWorkID AS WorkID, ow.ContractID AS OrderID, ow.WorkTypeID, wt.WorkName,
           ow.Quantity, ow.UnitCost, ow.Quantity * ow.UnitCost AS TotalCost, ow.Duration,
           ow.Status, ow.Comment, ow.CompletedAt, ow.CreatedAt, ow.UpdatedAt,
           ow.ResponsibleUserID, u.FullName AS ResponsibleName
    FROM OrderWorks ow
    JOIN WorkTypes wt ON ow.WorkTypeID = wt.WorkTypeID
    LEFT JOIN Users u ON ow.ResponsibleUserID = u.UserID
    WHERE ow.OrderWorkID = @OrderWorkID;

    SELECT wc.CommentID, wc.CommentText, wc.IsVisibleToClient, wc.CreatedAt,
           u.FullName AS AuthorName, u.Role AS AuthorRole
    FROM WorkComments wc JOIN Users u ON wc.AuthorID = u.UserID
    WHERE wc.OrderWorkID = @OrderWorkID ORDER BY wc.CreatedAt ASC;

    SELECT wf.FileID, wf.FileName, wf.FilePath, wf.Description, wf.FileSize, wf.MimeType,
           wf.UploadedAt, u.FullName AS UploaderName
    FROM WorkFiles wf JOIN Users u ON wf.UploadedBy = u.UserID
    WHERE wf.OrderWorkID = @OrderWorkID ORDER BY wf.UploadedAt DESC;
END
GO

-- Работы по заказу для клиента (без Services)
CREATE PROCEDURE sp_GetClientOrderWorks
    @ContractID INT, @ClientUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (
        SELECT 1 FROM Contracts c JOIN Applications a ON c.ApplicationID = a.ApplicationID
        WHERE c.ContractID = @ContractID AND a.ClientUserID = @ClientUserID
    )
    BEGIN RAISERROR('Доступ запрещен', 16, 1); RETURN; END

    SELECT ow.OrderWorkID AS WorkID, wt.WorkName, ow.Quantity, ow.UnitCost,
           ow.Quantity * ow.UnitCost AS TotalCost, ow.Duration, ow.Status, ow.CompletedAt,
           u.FullName AS ResponsibleName,
           (SELECT COUNT(*) FROM WorkFiles    wf WHERE wf.OrderWorkID = ow.OrderWorkID) AS FilesCount,
           (SELECT COUNT(*) FROM WorkComments wc WHERE wc.OrderWorkID = ow.OrderWorkID AND wc.IsVisibleToClient = 1) AS CommentsCount
    FROM OrderWorks ow
    JOIN WorkTypes wt ON ow.WorkTypeID = wt.WorkTypeID
    LEFT JOIN Users u ON ow.ResponsibleUserID = u.UserID
    WHERE ow.ContractID = @ContractID ORDER BY ow.SortOrder, ow.CreatedAt;

    SELECT wc.CommentID, wc.OrderWorkID, wc.CommentText, wc.CreatedAt,
           u.FullName AS AuthorName, wt.WorkName
    FROM WorkComments wc
    JOIN Users u ON wc.AuthorID = u.UserID JOIN OrderWorks ow ON wc.OrderWorkID = ow.OrderWorkID JOIN WorkTypes wt ON ow.WorkTypeID = wt.WorkTypeID
    WHERE ow.ContractID = @ContractID AND wc.IsVisibleToClient = 1 ORDER BY wc.CreatedAt DESC;

    SELECT wf.FileID, wf.OrderWorkID, wf.FileName, wf.FilePath, wf.Description, wf.FileSize,
           wf.UploadedAt, u.FullName AS UploaderName, wt.WorkName
    FROM WorkFiles wf
    JOIN Users u ON wf.UploadedBy = u.UserID JOIN OrderWorks ow ON wf.OrderWorkID = ow.OrderWorkID JOIN WorkTypes wt ON ow.WorkTypeID = wt.WorkTypeID
    WHERE ow.ContractID = @ContractID ORDER BY wf.UploadedAt DESC;
END
GO

-- Отзывы
CREATE PROCEDURE sp_AddReview
    @ApplicationID INT, @ClientUserID INT, @Rating TINYINT,
    @ReviewText NVARCHAR(MAX) = NULL, @ReviewID INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM Applications WHERE ApplicationID = @ApplicationID)
        BEGIN RAISERROR('Заказ с ID %d не найден', 16, 1, @ApplicationID); RETURN; END

        IF NOT EXISTS (SELECT 1 FROM Applications WHERE ApplicationID = @ApplicationID AND ClientUserID = @ClientUserID)
        BEGIN RAISERROR('Нет доступа к этому заказу', 16, 1); RETURN; END

        DECLARE @CurrentStatus NVARCHAR(50);
        SELECT @CurrentStatus = Status FROM Applications WHERE ApplicationID = @ApplicationID;
        IF @CurrentStatus != 'Завершена'
        BEGIN RAISERROR('Отзыв можно оставить только для завершенных заказов', 16, 1); RETURN; END

        IF EXISTS (SELECT 1 FROM Reviews WHERE ApplicationID = @ApplicationID)
        BEGIN RAISERROR('Вы уже оставили отзыв для этого заказа', 16, 1); RETURN; END

        IF @Rating < 1 OR @Rating > 5
        BEGIN RAISERROR('Оценка должна быть от 1 до 5', 16, 1); RETURN; END

        INSERT INTO Reviews (ApplicationID, ClientUserID, Rating, ReviewText, IsApproved, CreatedAt)
        VALUES (@ApplicationID, @ClientUserID, @Rating, @ReviewText, 0, GETDATE());
        SET @ReviewID = SCOPE_IDENTITY();

        UPDATE Contracts SET ReviewID = @ReviewID WHERE ApplicationID = @ApplicationID;
        COMMIT TRANSACTION;
        SELECT 'Отзыв успешно добавлен! ID: ' + CAST(@ReviewID AS NVARCHAR) AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

-- процедура удаления отзыва
CREATE OR ALTER PROCEDURE sp_DeleteReview
    @ReviewID INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- 1. Сначала обнуляем ссылки на этот отзыв в таблице Contracts
        UPDATE Contracts 
        SET ReviewID = NULL 
        WHERE ReviewID = @ReviewID;
        
        -- 2. Теперь можно безопасно удалить отзыв
        DELETE FROM Reviews 
        WHERE ReviewID = @ReviewID;
        
        COMMIT TRANSACTION;
        
        SELECT 'success' AS Status, 'Отзыв успешно удален' AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

CREATE PROCEDURE sp_GetClientOrdersWithReviews @ClientUserID INT
AS BEGIN
    SET NOCOUNT ON;
    SELECT c.ContractID AS id, c.ContractNumber AS number, c.TotalCost AS total,
           ISNULL(co.ObjectName, 'Объект строительства') AS objectName,
           a.Status, c.CreatedAt AS date, a.ApplicationID,
           CASE WHEN a.Status = 'В работе' THEN 'work' WHEN a.Status = 'Завершена' THEN 'completed' ELSE 'new' END AS statusClass,
           a.Status AS statusText,
           CASE WHEN r.ReviewID IS NOT NULL THEN 1 ELSE 0 END AS hasReview,
           r.Rating, r.IsApproved AS reviewApproved
    FROM Contracts c
    JOIN Applications a ON c.ApplicationID = a.ApplicationID
    LEFT JOIN ConstructionObjects co ON c.ObjectID = co.ObjectID
    LEFT JOIN Reviews r ON c.ReviewID = r.ReviewID
    WHERE a.ClientUserID = @ClientUserID ORDER BY c.CreatedAt DESC;
END
GO

CREATE PROCEDURE sp_GetClientDashboard @ClientUserID INT
AS BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(DISTINCT c.ContractID) AS totalOrders,
           SUM(CASE WHEN a.Status = 'В работе'  THEN 1 ELSE 0 END) AS inProgress,
           SUM(CASE WHEN a.Status = 'Завершена' THEN 1 ELSE 0 END) AS completed,
           COUNT(DISTINCT r.ReviewID) AS reviews
    FROM Applications a LEFT JOIN Contracts c ON a.ApplicationID = c.ApplicationID LEFT JOIN Reviews r ON a.ApplicationID = r.ApplicationID
    WHERE a.ClientUserID = @ClientUserID;

    SELECT TOP 5 c.ContractID AS id, c.ContractNumber AS number, c.TotalCost AS total,
           ISNULL(co.ObjectName, 'Объект строительства') AS objectName,
           a.Status, c.CreatedAt AS date, a.ApplicationID,
           CASE WHEN a.Status = 'В работе' THEN 'work' WHEN a.Status = 'Завершена' THEN 'completed' ELSE 'new' END AS statusClass,
           a.Status AS statusText, CASE WHEN r.ReviewID IS NOT NULL THEN 1 ELSE 0 END AS hasReview
    FROM Contracts c JOIN Applications a ON c.ApplicationID = a.ApplicationID
    LEFT JOIN ConstructionObjects co ON c.ObjectID = co.ObjectID LEFT JOIN Reviews r ON c.ReviewID = r.ReviewID
    WHERE a.ClientUserID = @ClientUserID ORDER BY c.CreatedAt DESC;
END
GO

CREATE PROCEDURE sp_ModerateReview @ReviewID INT, @IsApproved BIT, @ModeratorID INT
AS BEGIN SET NOCOUNT ON; UPDATE Reviews SET IsApproved = @IsApproved WHERE ReviewID = @ReviewID; END
GO

CREATE PROCEDURE sp_GetReviewsForAdmin
    @Page INT = 1, @PageSize INT = 10, @IsApproved BIT = NULL, @Search NVARCHAR(100) = ''
AS BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    SELECT r.ReviewID, r.Rating, r.ReviewText, r.IsApproved, r.CreatedAt,
           u.FullName AS ClientName, u.Email AS ClientEmail, u.Phone AS ClientPhone,
           a.ApplicationID, ISNULL(c.ContractNumber, 'Не оформлен') AS OrderNumber
    FROM Reviews r JOIN Users u ON r.ClientUserID = u.UserID JOIN Applications a ON r.ApplicationID = a.ApplicationID LEFT JOIN Contracts c ON a.ApplicationID = c.ApplicationID
    WHERE (@IsApproved IS NULL OR r.IsApproved = @IsApproved)
      AND (@Search = '' OR u.FullName LIKE '%' + @Search + '%' OR u.Email LIKE '%' + @Search + '%' OR ISNULL(r.ReviewText, '') LIKE '%' + @Search + '%')
    ORDER BY r.CreatedAt DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(*) AS TotalCount FROM Reviews r JOIN Users u ON r.ClientUserID = u.UserID
    WHERE (@IsApproved IS NULL OR r.IsApproved = @IsApproved)
      AND (@Search = '' OR u.FullName LIKE '%' + @Search + '%' OR u.Email LIKE '%' + @Search + '%' OR ISNULL(r.ReviewText, '') LIKE '%' + @Search + '%');
END
GO

CREATE PROCEDURE sp_GetPublicReviews @Limit INT = 10
AS BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@Limit) r.ReviewID, r.Rating, r.ReviewText, r.CreatedAt,
           u.FullName AS ClientName, ISNULL(c.ContractNumber, 'Заказ') AS OrderNumber,
           ISNULL(ot.TypeName, 'Строительство') AS ObjectType
    FROM Reviews r JOIN Users u ON r.ClientUserID = u.UserID JOIN Applications a ON r.ApplicationID = a.ApplicationID
    LEFT JOIN Contracts c ON a.ApplicationID = c.ApplicationID LEFT JOIN ConstructionObjects co ON a.ObjectID = co.ObjectID LEFT JOIN ObjectTypes ot ON co.ObjectTypeID = ot.ObjectTypeID
    WHERE r.IsApproved = 1 ORDER BY r.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE sp_CheckEmailExists @Email NVARCHAR(150), @ExcludeUserID INT = NULL
AS BEGIN SET NOCOUNT ON; SELECT COUNT(*) AS cnt FROM Users WHERE Email = @Email AND (@ExcludeUserID IS NULL OR UserID != @ExcludeUserID); END
GO

CREATE OR ALTER PROCEDURE sp_CheckPhoneExists @Phone NVARCHAR(20), @ExcludeUserID INT = NULL
AS BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(*) AS cnt FROM Users WHERE Phone = @Phone AND Phone IS NOT NULL AND Phone != '' AND (@ExcludeUserID IS NULL OR UserID != @ExcludeUserID);
END
GO

-- Удаление всех правил для типа объекта
CREATE OR ALTER PROCEDURE sp_DeleteWorkRulesByObjectType
    @ObjectTypeID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM ObjectTypeWorkRequirements WHERE ObjectTypeID = @ObjectTypeID;
    
    SELECT @@ROWCOUNT AS DeletedCount;
END
GO


-- ============================================
-- ТРИГГЕРЫ
-- ============================================

CREATE TRIGGER trg_Applications_Update ON Applications AFTER UPDATE AS
BEGIN SET NOCOUNT ON; UPDATE a SET UpdatedAt = GETDATE() FROM Applications a INNER JOIN inserted i ON a.ApplicationID = i.ApplicationID; END
GO

CREATE TRIGGER trg_ContractDetails_ValidateDates ON ContractDetails AFTER INSERT, UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted WHERE StartDate > EndDate)
    BEGIN RAISERROR('Дата начала не может быть позже даты окончания', 16, 1); ROLLBACK TRANSACTION; RETURN; END
END
GO

CREATE TRIGGER trg_OrderWorks_Update ON OrderWorks AFTER UPDATE AS
BEGIN SET NOCOUNT ON; UPDATE ow SET UpdatedAt = GETDATE() FROM OrderWorks ow INNER JOIN inserted i ON ow.OrderWorkID = i.OrderWorkID; END
GO

CREATE TRIGGER trg_Contracts_Update ON Contracts AFTER UPDATE AS
BEGIN SET NOCOUNT ON; UPDATE c SET UpdatedAt = GETDATE() FROM Contracts c INNER JOIN inserted i ON c.ContractID = i.ContractID; END
GO

CREATE TRIGGER trg_ClientCompanies_Update ON ClientCompanies AFTER UPDATE AS
BEGIN SET NOCOUNT ON; UPDATE cc SET UpdatedAt = GETDATE() FROM ClientCompanies cc INNER JOIN inserted i ON cc.CompanyID = i.CompanyID; END
GO

CREATE TRIGGER trg_ConstructionObjects_Update ON ConstructionObjects AFTER UPDATE AS
BEGIN SET NOCOUNT ON; UPDATE co SET UpdatedAt = GETDATE() FROM ConstructionObjects co INNER JOIN inserted i ON co.ObjectID = i.ObjectID; END
GO

CREATE TRIGGER trg_WorkComments_Update ON WorkComments AFTER UPDATE AS
BEGIN SET NOCOUNT ON; UPDATE wc SET UpdatedAt = GETDATE() FROM WorkComments wc INNER JOIN inserted i ON wc.CommentID = i.CommentID; END
GO

CREATE TRIGGER trg_Applications_History ON Applications AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO SpecialistHistory (SpecialistID, ActionType, ApplicationID, Description, Details)
    SELECT i.SpecialistID, 'application_status', i.ApplicationID,
           'Статус заявки изменен', CONCAT('Статус изменен с "', d.Status, '" на "', i.Status, '"')
    FROM inserted i INNER JOIN deleted d ON i.ApplicationID = d.ApplicationID
    WHERE i.Status != d.Status AND i.SpecialistID IS NOT NULL;
END
GO

CREATE TRIGGER trg_Contracts_History ON Contracts AFTER INSERT AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO SpecialistHistory (SpecialistID, ActionType, ApplicationID, OrderID, Description, Details)
    SELECT a.SpecialistID, 'order_created', a.ApplicationID, i.ContractID,
           'Создан новый заказ', CONCAT('Номер договора: ', i.ContractNumber)
    FROM inserted i INNER JOIN Applications a ON i.ApplicationID = a.ApplicationID
    WHERE a.SpecialistID IS NOT NULL;
END
GO

CREATE OR ALTER TRIGGER trg_OrderWorks_UpdateAll ON OrderWorks AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    DECLARE @AffectedContracts TABLE (ContractID INT);
    INSERT INTO @AffectedContracts SELECT DISTINCT ContractID FROM inserted
    UNION SELECT DISTINCT ContractID FROM deleted WHERE ContractID IS NOT NULL;

    UPDATE c SET TotalCost = (SELECT ISNULL(SUM(Quantity * UnitCost), 0) FROM OrderWorks ow WHERE ow.ContractID = c.ContractID)
    FROM Contracts c INNER JOIN @AffectedContracts ac ON c.ContractID = ac.ContractID;

    UPDATE cd SET
        VATAmount      = ROUND(c.TotalCost * cd.VATRate / (100 + cd.VATRate), 2),
        CostWithoutVAT = ROUND(c.TotalCost * 100 / (100 + cd.VATRate), 2),
        TotalCostWords = dbo.fn_NumberToWords(c.TotalCost),
        VATAmountWords = dbo.fn_NumberToWords(ROUND(c.TotalCost * cd.VATRate / (100 + cd.VATRate), 2))
    FROM ContractDetails cd
    INNER JOIN Contracts c ON cd.ContractID = c.ContractID
    INNER JOIN @AffectedContracts ac ON cd.ContractID = ac.ContractID;
END
GO

ENABLE TRIGGER trg_OrderWorks_UpdateAll ON OrderWorks;
GO


-- ============================================
-- ФУНКЦИЯ ГЕНЕРАЦИИ ТЕКСТА ДОГОВОРА
-- ============================================

CREATE OR ALTER FUNCTION dbo.fn_GenerateContractText (@ContractID INT)
RETURNS NVARCHAR(MAX)
AS
BEGIN
    DECLARE @Result NVARCHAR(MAX);
    DECLARE @ContractNumber NVARCHAR(50), @SignDate DATE, @City NVARCHAR(100);
    DECLARE @CompanyName NVARCHAR(300), @UNP NVARCHAR(50), @LegalAddress NVARCHAR(500);
    DECLARE @DirectorLastName NVARCHAR(100), @DirectorFirstName NVARCHAR(100), @DirectorPatronymic NVARCHAR(100);
    DECLARE @DirectorPosition NVARCHAR(100), @AuthorityDoc NVARCHAR(100);
    DECLARE @BankName NVARCHAR(300), @BankAccount NVARCHAR(100), @BankBIC NVARCHAR(50);
    DECLARE @ObjectName NVARCHAR(500), @ObjectAddress NVARCHAR(500), @ObjectType NVARCHAR(100);
    DECLARE @StartDate DATE, @EndDate DATE;
    DECLARE @CostWithoutVAT DECIMAL(18,2), @VATRate INT, @VATAmount DECIMAL(18,2);
    DECLARE @TotalCost DECIMAL(18,2), @TotalCostWords NVARCHAR(500), @PaymentSchedule NVARCHAR(MAX);
    DECLARE @WorksTable NVARCHAR(MAX);
    DECLARE @DirectorFullName NVARCHAR(300);

    SELECT
        @ContractNumber   = c.ContractNumber, @SignDate = c.SignDate, @City = c.City, @TotalCost = c.TotalCost,
        @CompanyName      = cc.CompanyName, @UNP = cc.UNP, @LegalAddress = cc.LegalAddress,
        @DirectorLastName = cc.DirectorLastName, @DirectorFirstName = cc.DirectorFirstName,
        @DirectorPatronymic = cc.DirectorPatronymic, @DirectorPosition = cc.DirectorPosition,
        @AuthorityDoc     = cc.AuthorityDoc,
        @ObjectName       = co.ObjectName, @ObjectAddress = co.ObjectAddress, @ObjectType = ot.TypeName,
        @StartDate        = cd.StartDate, @EndDate = cd.EndDate, @CostWithoutVAT = cd.CostWithoutVAT,
        @VATRate          = cd.VATRate, @VATAmount = cd.VATAmount, @TotalCostWords = cd.TotalCostWords,
        @PaymentSchedule  = cd.PaymentSchedule
    FROM dbo.Contracts c
    JOIN dbo.ClientCompanies cc      ON c.CompanyID     = cc.CompanyID
    JOIN dbo.ConstructionObjects co  ON c.ObjectID      = co.ObjectID
    JOIN dbo.Applications a          ON c.ApplicationID = a.ApplicationID
    LEFT JOIN dbo.ObjectTypes ot     ON co.ObjectTypeID = ot.ObjectTypeID
    LEFT JOIN dbo.ContractDetails cd ON c.ContractID    = cd.ContractID
    WHERE c.ContractID = @ContractID;

    -- Формируем полное ФИО
    SET @DirectorFullName = CONCAT_WS(' ', @DirectorLastName, @DirectorFirstName, @DirectorPatronymic);
    IF @DirectorFullName IS NULL OR @DirectorFullName = '' SET @DirectorFullName = '____________________';

    SELECT TOP 1 @BankName = BankName, @BankAccount = BankAccount, @BankBIC = BankBIC
    FROM dbo.CompanyBankDetails
    WHERE CompanyID = (SELECT CompanyID FROM dbo.Contracts WHERE ContractID = @ContractID)
    ORDER BY IsPrimary DESC;

    ;WITH NumberedWorks AS (
        SELECT ROW_NUMBER() OVER (ORDER BY ISNULL(ow.SortOrder, 999), ow.CreatedAt) AS RowNum,
               wt.WorkName, ow.Quantity, ow.UnitCost, (ow.Quantity * ow.UnitCost) AS TotalCost
        FROM dbo.OrderWorks ow JOIN dbo.WorkTypes wt ON ow.WorkTypeID = wt.WorkTypeID
        WHERE ow.ContractID = @ContractID
    )
    SELECT @WorksTable = STRING_AGG(
        CONCAT('    ', CAST(RowNum AS NVARCHAR(10)), '. ', WorkName, ' - ',
               FORMAT(Quantity, 'N2'), ' ед. х ', FORMAT(UnitCost, 'N2'), ' руб. = ', FORMAT(TotalCost, 'N2'), ' руб.'),
        CHAR(13) + CHAR(10)) FROM NumberedWorks;

    IF @WorksTable IS NULL SET @WorksTable = '    Работы не добавлены';
    IF @CompanyName IS NULL SET @CompanyName = '____________________';
    IF @DirectorPosition IS NULL SET @DirectorPosition = 'директора';
    IF @AuthorityDoc IS NULL SET @AuthorityDoc = 'Устава';
    IF @City IS NULL SET @City = 'г. Минск';
    IF @SignDate IS NULL SET @SignDate = GETDATE();
    IF @StartDate IS NULL SET @StartDate = @SignDate;
    IF @EndDate IS NULL SET @EndDate = DATEADD(month, 1, @SignDate);
    IF @CostWithoutVAT IS NULL SET @CostWithoutVAT = 0;
    IF @VATRate IS NULL SET @VATRate = 20;
    IF @VATAmount IS NULL SET @VATAmount = @CostWithoutVAT * @VATRate / 100;
    IF @TotalCost IS NULL SET @TotalCost = @CostWithoutVAT + @VATAmount;
    IF @TotalCostWords IS NULL SET @TotalCostWords = '________________________________________________';

    DECLARE @VATAmountWords NVARCHAR(500) = dbo.fn_NumberToWords(@VATAmount);

    DECLARE @MonthName NVARCHAR(20) = CASE MONTH(@SignDate)
        WHEN 1 THEN 'января' WHEN 2 THEN 'февраля' WHEN 3 THEN 'марта'
        WHEN 4 THEN 'апреля' WHEN 5 THEN 'мая' WHEN 6 THEN 'июня'
        WHEN 7 THEN 'июля' WHEN 8 THEN 'августа' WHEN 9 THEN 'сентября'
        WHEN 10 THEN 'октября' WHEN 11 THEN 'ноября' WHEN 12 THEN 'декабря' END;

    SET @Result =
'ДОГОВОР СТРОИТЕЛЬНОГО ПОДРЯДА №' + ISNULL(@ContractNumber, '______') + '

' + @City + '
«' + FORMAT(@SignDate, 'dd') + '» ' + @MonthName + ' ' + FORMAT(@SignDate, 'yyyy') + ' г.

    Общество с ограниченной ответственностью «' + @CompanyName + '», именуемое в дальнейшем «Заказчик», в лице ' +
    @DirectorPosition + ' ' + @DirectorFullName + ', действующего на основании ' + @AuthorityDoc +
    ', с одной стороны, и Общество с ограниченной ответственностью «МСК Релайбл», именуемое в дальнейшем «Подрядчик», в лице директора Хурс В.И., действующего на основании Устава, с другой стороны, заключили настоящий договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. Подрядчик обязуется выполнить комплекс строительно-монтажных работ на объекте: «' +
    ISNULL(@ObjectName, 'Строительство объекта') +
    CASE WHEN @ObjectAddress IS NOT NULL THEN ', расположенного по адресу: ' + @ObjectAddress ELSE '' END +
    '» и сдать их Заказчику, а Заказчик обязуется принять результаты работ и уплатить обусловленную Договором цену.

2. СРОКИ ВЫПОЛНЕНИЯ РАБОТ
2.1. Начало выполнения Работ – ' + FORMAT(@StartDate, 'dd.MM.yyyy') + ' г.
2.2. Окончание выполнения Работ – ' + FORMAT(@EndDate, 'dd.MM.yyyy') + ' г.

3. ЦЕНА ДОГОВОРА
3.1. Цена Договора составляет ' +
    FORMAT(@CostWithoutVAT + @VATAmount, 'N2') + ' (' + @TotalCostWords + ') с учетом НДС ' +
    CAST(@VATRate AS NVARCHAR) + '% - ' + FORMAT(@VATAmount, 'N2') + ' (' + @VATAmountWords + ').

14. АДРЕСА, РЕКВИЗИТЫ И ПОДПИСИ СТОРОН

ПОДРЯДЧИК:
ООО «МСК Релайбл»
Адрес: 220113, г. Минск, ул. Мележа, д. 4
УНП: 193607959
р/с: BY91ALFA30122B38250010270000 в BYN
в ЗАО «Альфа-Банк», БИК: ALFABY2X
E-mail: MCK-Reliable@yandex.ru
Тел.: +375444543857

Директор
__________ В.И. Хурс


ЗАКАЗЧИК:
' + @CompanyName + '
' + CASE WHEN @UNP IS NOT NULL THEN 'УНП: ' + @UNP + CHAR(13) + CHAR(10) ELSE '' END +
CASE WHEN @LegalAddress IS NOT NULL THEN 'Адрес: ' + @LegalAddress + CHAR(13) + CHAR(10) ELSE '' END +
CASE WHEN @BankName IS NOT NULL THEN 'Банк: ' + @BankName + CHAR(13) + CHAR(10) ELSE '' END +
CASE WHEN @BankAccount IS NOT NULL THEN 'р/с: ' + @BankAccount + CHAR(13) + CHAR(10) ELSE '' END +
CASE WHEN @BankBIC IS NOT NULL THEN 'БИК: ' + @BankBIC + CHAR(13) + CHAR(10) ELSE '' END + '
' + @DirectorPosition + '
__________ ' + @DirectorFullName;

    RETURN @Result;
END;
GO
-- Таблица 
CREATE TABLE PushSubscriptions (
    SubscriptionID  INT IDENTITY PRIMARY KEY,
    UserID          INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
    Endpoint        VARCHAR(500) NOT NULL,
    P256dh          VARCHAR(200) NOT NULL,
    Auth            VARCHAR(50) NOT NULL,
    CreatedAt       DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT UQ_Push_Endpoint UNIQUE (Endpoint)
);
CREATE INDEX IX_Push_UserID ON PushSubscriptions(UserID);
GO

-- Сохранение/обновление подписки
CREATE OR ALTER PROCEDURE sp_SavePushSubscription
    @UserID   INT,
    @Endpoint NVARCHAR(500),
    @P256dh   NVARCHAR(500),
    @Auth     NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    MERGE PushSubscriptions AS t
    USING (SELECT @Endpoint AS Endpoint) AS s ON t.Endpoint = s.Endpoint
    WHEN MATCHED THEN
        UPDATE SET P256dh = @P256dh, Auth = @Auth, UserID = @UserID
    WHEN NOT MATCHED THEN
        INSERT (UserID, Endpoint, P256dh, Auth)
        VALUES (@UserID, @Endpoint, @P256dh, @Auth);
END;
GO

-- Удаление всех подписок пользователя
CREATE OR ALTER PROCEDURE sp_DeletePushSubscriptions
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM PushSubscriptions WHERE UserID = @UserID;
END;
GO

-- Удаление протухшей подписки по endpoint
CREATE OR ALTER PROCEDURE sp_DeletePushSubscriptionByEndpoint
    @Endpoint NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM PushSubscriptions WHERE Endpoint = @Endpoint;
END;
GO

-- Получение подписок клиента для отправки push
CREATE OR ALTER PROCEDURE sp_GetPushSubscriptionsByUser
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Endpoint, P256dh, Auth
    FROM PushSubscriptions
    WHERE UserID = @UserID;
END;
GO

-- Получение клиента и названия работы по WorkID (для уведомления при смене статуса)
CREATE OR ALTER PROCEDURE sp_GetWorkClientInfo
    @WorkID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        u.UserID,
        wt.WorkName,
        ow.Status
    FROM OrderWorks ow
    JOIN WorkTypes wt     ON ow.WorkTypeID = wt.WorkTypeID
    JOIN Contracts c      ON ow.ContractID = c.ContractID
    JOIN Applications a   ON c.ApplicationID = a.ApplicationID
    JOIN Users u          ON a.ClientUserID = u.UserID
    WHERE ow.OrderWorkID = @WorkID;
END;
GO

 
-- ============================================
-- ТИПЫ ОБЪЕКТОВ (ObjectTypes)
-- ============================================
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_GetObjectTypes')
    DROP PROCEDURE sp_Admin_GetObjectTypes
GO
CREATE PROCEDURE sp_Admin_GetObjectTypes
    @IncludeInactive BIT = 1,
    @Search          NVARCHAR(100) = ''
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        ObjectTypeID,
        TypeName,
        IsActive,
        SortOrder,
        (SELECT COUNT(*) FROM ConstructionObjects WHERE ObjectTypeID = ot.ObjectTypeID) AS ObjectsCount,
        (SELECT COUNT(*) FROM ObjectTypeWorkRequirements WHERE ObjectTypeID = ot.ObjectTypeID) AS RulesCount
    FROM ObjectTypes ot
    WHERE (@IncludeInactive = 1 OR IsActive = 1)
      AND (@Search = '' OR TypeName LIKE '%' + @Search + '%'
                        OR ISNULL(Description,'') LIKE '%' + @Search + '%')
    ORDER BY SortOrder, TypeName;
END
GO
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_GetObjectTypeById')
    DROP PROCEDURE sp_Admin_GetObjectTypeById
GO
CREATE PROCEDURE sp_Admin_GetObjectTypeById
    @ObjectTypeID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ObjectTypeID, TypeName, IsActive, SortOrder
    FROM ObjectTypes
    WHERE ObjectTypeID = @ObjectTypeID;
END
GO
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_CreateObjectType')
    DROP PROCEDURE sp_Admin_CreateObjectType
GO
CREATE PROCEDURE sp_Admin_CreateObjectType
    @TypeName     NVARCHAR(100),
    @IsActive     BIT           = 1,
    @SortOrder    INT           = 0,
    @NewID        INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM ObjectTypes WHERE TypeName = @TypeName)
    BEGIN
        RAISERROR('Тип объекта с таким названием уже существует', 16, 1);
        RETURN;
    END
    INSERT INTO ObjectTypes (TypeName, IsActive, SortOrder)
    VALUES (@TypeName, @IsActive, @SortOrder);
    SET @NewID = SCOPE_IDENTITY();
END
GO
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_UpdateObjectType')
    DROP PROCEDURE sp_Admin_UpdateObjectType
GO
CREATE PROCEDURE sp_Admin_UpdateObjectType
    @ObjectTypeID INT,
    @TypeName     NVARCHAR(100),
    @IsActive     BIT           = 1,
    @SortOrder    INT           = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM ObjectTypes WHERE TypeName = @TypeName AND ObjectTypeID != @ObjectTypeID)
    BEGIN
        RAISERROR('Тип объекта с таким названием уже существует', 16, 1);
        RETURN;
    END
    UPDATE ObjectTypes
    SET TypeName = @TypeName,
        IsActive = @IsActive, SortOrder = @SortOrder
    WHERE ObjectTypeID = @ObjectTypeID;
END
GO
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_DeleteObjectType')
    DROP PROCEDURE sp_Admin_DeleteObjectType
GO
CREATE PROCEDURE sp_Admin_DeleteObjectType
    @ObjectTypeID  INT,
    @HardDelete    BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF @HardDelete = 1
    BEGIN
        IF EXISTS (SELECT 1 FROM ConstructionObjects WHERE ObjectTypeID = @ObjectTypeID)
        BEGIN
            RAISERROR('Невозможно удалить: существуют объекты строительства с данным типом', 16, 1);
            RETURN;
        END
        DELETE FROM ObjectTypeWorkRequirements WHERE ObjectTypeID = @ObjectTypeID;
        DELETE FROM ObjectTypes WHERE ObjectTypeID = @ObjectTypeID;
    END
    ELSE
        UPDATE ObjectTypes SET IsActive = 0 WHERE ObjectTypeID = @ObjectTypeID;
END
GO
 
-- ============================================
-- ВИДЫ РАБОТ (WorkTypes)
-- ============================================
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_GetWorkTypes')
    DROP PROCEDURE sp_Admin_GetWorkTypes
GO
CREATE PROCEDURE sp_Admin_GetWorkTypes
    @IncludeInactive BIT           = 1,
    @Search          NVARCHAR(100) = '',
    @Page            INT           = 1,
    @PageSize        INT           = 20
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
 
    SELECT
        wt.WorkTypeID,
        wt.WorkName,
		wt.Description,
        wt.DefaultDuration,
        wt.BaseCost,
        wt.IsActive,
        (SELECT COUNT(*) FROM OrderWorks WHERE WorkTypeID = wt.WorkTypeID) AS UsageCount,
        (SELECT COUNT(*) FROM ObjectTypeWorkRequirements WHERE WorkTypeID = wt.WorkTypeID) AS RulesCount
    FROM WorkTypes wt
    WHERE (@IncludeInactive = 1 OR IsActive = 1)
      AND (@Search = '' OR WorkName LIKE '%' + @Search + '%')
    ORDER BY WorkName
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
 
    SELECT COUNT(*) AS TotalCount
    FROM WorkTypes
    WHERE (@IncludeInactive = 1 OR IsActive = 1)
      AND (@Search = '' OR WorkName LIKE '%' + @Search + '%');
END
GO
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_GetWorkTypeById')
    DROP PROCEDURE sp_Admin_GetWorkTypeById
GO
CREATE PROCEDURE sp_Admin_GetWorkTypeById
    @WorkTypeID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT WorkTypeID, WorkName, Description, DefaultDuration, BaseCost, IsActive
    FROM WorkTypes
    WHERE WorkTypeID = @WorkTypeID;
END
GO
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_CreateWorkType')
    DROP PROCEDURE sp_Admin_CreateWorkType
GO
CREATE PROCEDURE sp_Admin_CreateWorkType
    @WorkName        NVARCHAR(200),
	@Description     NVARCHAR(500) = NULL,
    @DefaultDuration INT           = NULL,
    @BaseCost        DECIMAL(18,2) = NULL,
    @IsActive        BIT           = 1,
    @NewID           INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM WorkTypes WHERE WorkName = @WorkName)
    BEGIN
        RAISERROR('Вид работы с таким названием уже существует', 16, 1);
        RETURN;
    END
    INSERT INTO WorkTypes (WorkName, Description, DefaultDuration, BaseCost, IsActive)
    VALUES (@WorkName,@Description, @DefaultDuration, @BaseCost, @IsActive);
    SET @NewID = SCOPE_IDENTITY();
END
GO
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_UpdateWorkType')
    DROP PROCEDURE sp_Admin_UpdateWorkType
GO
CREATE PROCEDURE sp_Admin_UpdateWorkType
    @WorkTypeID      INT,
    @WorkName        NVARCHAR(200),
	@Description     NVARCHAR(500) = NULL,
    @DefaultDuration INT           = NULL,
    @BaseCost        DECIMAL(18,2) = NULL,
    @IsActive        BIT           = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM WorkTypes WHERE WorkName = @WorkName AND WorkTypeID != @WorkTypeID)
    BEGIN
        RAISERROR('Вид работы с таким названием уже существует', 16, 1);
        RETURN;
    END
    UPDATE WorkTypes
    SET WorkName = @WorkName,Description = @Description, DefaultDuration = @DefaultDuration,
        BaseCost = @BaseCost, IsActive = @IsActive
    WHERE WorkTypeID = @WorkTypeID;
END
GO
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_DeleteWorkType')
    DROP PROCEDURE sp_Admin_DeleteWorkType
GO
CREATE PROCEDURE sp_Admin_DeleteWorkType
    @WorkTypeID INT,
    @HardDelete BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF @HardDelete = 1
    BEGIN
        IF EXISTS (SELECT 1 FROM OrderWorks WHERE WorkTypeID = @WorkTypeID)
        BEGIN
            RAISERROR('Невозможно удалить: вид работы используется в заказах', 16, 1);
            RETURN;
        END
        DELETE FROM ObjectTypeWorkRequirements WHERE WorkTypeID = @WorkTypeID;
        DELETE FROM WorkTypes WHERE WorkTypeID = @WorkTypeID;
    END
    ELSE
        UPDATE WorkTypes SET IsActive = 0 WHERE WorkTypeID = @WorkTypeID;
END
GO
 
-- ============================================
-- КЛИЕНТЫ (Users с role='client' + ClientCompanies)
-- ============================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_GetClients')
    DROP PROCEDURE sp_Admin_GetClients
GO
CREATE OR ALTER PROCEDURE sp_Admin_GetClients
    @Page            INT           = 1,
    @PageSize        INT           = 10,
    @Search          NVARCHAR(100) = ''
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
 
    SELECT
        u.UserID,
        u.FullName,
        u.Email,
        u.Phone,
        u.CreatedAt,
        u.LastLoginAt,
        cc.CompanyID,
        cc.CompanyName,
        cc.UNP,
        cc.LegalAddress,
        CONCAT_WS(' ', cc.DirectorLastName, cc.DirectorFirstName, cc.DirectorPatronymic) AS DirectorName,
        (SELECT COUNT(*) FROM Applications a WHERE a.ClientUserID = u.UserID) AS ApplicationsCount,
        (SELECT COUNT(*) FROM Applications a 
         JOIN Contracts c ON a.ApplicationID = c.ApplicationID
         WHERE a.ClientUserID = u.UserID) AS OrdersCount
    FROM Users u
    LEFT JOIN ClientCompanies cc ON u.UserID = cc.UserID
    WHERE u.Role = 'client'
      AND (@Search = '' OR u.FullName       LIKE '%' + @Search + '%'
                        OR u.Email          LIKE '%' + @Search + '%'
                        OR u.Phone          LIKE '%' + @Search + '%'
                        OR cc.CompanyName   LIKE '%' + @Search + '%'
                        OR cc.UNP           LIKE '%' + @Search + '%')
    ORDER BY u.CreatedAt DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
 
    SELECT COUNT(*) AS TotalCount
    FROM Users u
    LEFT JOIN ClientCompanies cc ON u.UserID = cc.UserID
    WHERE u.Role = 'client'
      AND (@Search = '' OR u.FullName       LIKE '%' + @Search + '%'
                        OR u.Email          LIKE '%' + @Search + '%'
                        OR u.Phone          LIKE '%' + @Search + '%'
                        OR cc.CompanyName   LIKE '%' + @Search + '%'
                        OR cc.UNP           LIKE '%' + @Search + '%');
END;
GO
 IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_GetClientById')
    DROP PROCEDURE sp_Admin_GetClientById
GO
CREATE OR ALTER PROCEDURE sp_Admin_GetClientById
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP 1 
        u.UserID, 
        u.FullName, 
        u.Email, 
        u.Phone, 
        u.IsActive, 
        u.CreatedAt, 
        u.LastLoginAt,
        cc.CompanyID, 
        cc.CompanyName, 
        cc.UNP, 
        cc.OKPO, 
        cc.LegalAddress,
        cc.DirectorLastName,
        cc.DirectorFirstName,
        cc.DirectorPatronymic,
        cc.DirectorPosition, 
        cc.AuthorityDoc, 
        cc.Website
    FROM Users u
    LEFT JOIN ClientCompanies cc ON u.UserID = cc.UserID
    WHERE u.UserID = @UserID AND u.Role = 'client';

    SELECT 
        bd.BankDetailID, 
        bd.BankName, 
        bd.BankAccount, 
        bd.BankBIC, 
        bd.IsPrimary, 
        bd.IsActive
    FROM CompanyBankDetails bd
    WHERE bd.CompanyID = (SELECT TOP 1 CompanyID FROM ClientCompanies WHERE UserID = @UserID)
    ORDER BY bd.IsPrimary DESC;

    SELECT
        c.ContractID, 
        c.ContractNumber, 
        c.SignDate, 
        c.TotalCost,
        a.Status, 
        a.ApplicationID,
        co.ObjectName, 
        co.ObjectAddress
    FROM Contracts c
    JOIN Applications a ON c.ApplicationID = a.ApplicationID
    LEFT JOIN ConstructionObjects co ON c.ObjectID = co.ObjectID
    WHERE a.ClientUserID = @UserID
    ORDER BY c.CreatedAt DESC;
END
GO
 
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_UpdateClient')
    DROP PROCEDURE sp_Admin_UpdateClient
GO
CREATE OR ALTER PROCEDURE sp_Admin_UpdateClient
    @UserID            INT,
    @FullName          NVARCHAR(200),
    @Email             NVARCHAR(150),
    @Phone             NVARCHAR(20)  = NULL,
    @IsActive          BIT           = 1,
    @CompanyName       NVARCHAR(300) = NULL,
    @UNP               NVARCHAR(50)  = NULL,
    @OKPO              NVARCHAR(50)  = NULL,
    @LegalAddress      NVARCHAR(500) = NULL,
    @DirectorLastName  NVARCHAR(100) = NULL,
    @DirectorFirstName NVARCHAR(100) = NULL,
    @DirectorPatronymic NVARCHAR(100) = NULL,
    @DirectorPosition  NVARCHAR(100) = NULL,
    @AuthorityDoc      NVARCHAR(100) = NULL,
    @Website           NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
 
        IF EXISTS (SELECT 1 FROM Users WHERE Email = @Email AND UserID != @UserID)
        BEGIN
            RAISERROR('Пользователь с таким email уже существует', 16, 1);
            RETURN;
        END
 
        UPDATE Users
        SET FullName = @FullName, Email = @Email, Phone = @Phone, IsActive = @IsActive
        WHERE UserID = @UserID AND Role = 'client';
 
        IF @CompanyName IS NOT NULL
        BEGIN
            IF EXISTS (SELECT 1 FROM ClientCompanies WHERE UserID = @UserID)
                UPDATE ClientCompanies
                SET CompanyName       = ISNULL(@CompanyName, CompanyName),
                    UNP               = ISNULL(@UNP, UNP),
                    OKPO              = ISNULL(@OKPO, OKPO),
                    LegalAddress      = ISNULL(@LegalAddress, LegalAddress),
                    DirectorLastName  = ISNULL(@DirectorLastName, DirectorLastName),
                    DirectorFirstName = ISNULL(@DirectorFirstName, DirectorFirstName),
                    DirectorPatronymic = ISNULL(@DirectorPatronymic, DirectorPatronymic),
                    DirectorPosition  = ISNULL(@DirectorPosition, DirectorPosition),
                    AuthorityDoc      = ISNULL(@AuthorityDoc, AuthorityDoc),
                    Website           = ISNULL(@Website, Website)
                WHERE UserID = @UserID;
            ELSE
                INSERT INTO ClientCompanies
                    (UserID, CompanyName, UNP, OKPO, LegalAddress, 
                     DirectorLastName, DirectorFirstName, DirectorPatronymic,
                     DirectorPosition, AuthorityDoc, Website)
                VALUES
                    (@UserID, @CompanyName, @UNP, @OKPO, @LegalAddress,
                     @DirectorLastName, @DirectorFirstName, @DirectorPatronymic,
                     @DirectorPosition, @AuthorityDoc, @Website);
        END
 
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_Admin_DeleteClient')
    DROP PROCEDURE sp_Admin_DeleteClient
GO
CREATE PROCEDURE sp_Admin_DeleteClient
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @ApplicationIDs TABLE (ApplicationID INT);
    INSERT INTO @ApplicationIDs
    SELECT ApplicationID FROM Applications WHERE ClientUserID = @UserID;
    
    -- 2. Получаем все ContractID клиента
    DECLARE @ContractIDs TABLE (ContractID INT);
    INSERT INTO @ContractIDs
    SELECT DISTINCT c.ContractID
    FROM Contracts c
    WHERE c.ApplicationID IN (SELECT ApplicationID FROM @ApplicationIDs);
    
    -- 3. Получаем все OrderWorkID клиента
    DECLARE @OrderWorkIDs TABLE (OrderWorkID INT);
    INSERT INTO @OrderWorkIDs
    SELECT OrderWorkID FROM OrderWorks 
    WHERE ContractID IN (SELECT ContractID FROM @ContractIDs);
    
    -- 4. Удаляем файлы работ
    DELETE FROM WorkFiles WHERE OrderWorkID IN (SELECT OrderWorkID FROM @OrderWorkIDs);
    
    -- 5. Удаляем комментарии к работам
    DELETE FROM WorkComments WHERE OrderWorkID IN (SELECT OrderWorkID FROM @OrderWorkIDs);
    
    -- 6. Удаляем работы
    DELETE FROM OrderWorks WHERE ContractID IN (SELECT ContractID FROM @ContractIDs);
    
    -- 7. Удаляем детали договоров
    DELETE FROM ContractDetails WHERE ContractID IN (SELECT ContractID FROM @ContractIDs);
    
    -- 8. Обнуляем ссылки на отзывы в договорах
    UPDATE Contracts SET ReviewID = NULL WHERE ContractID IN (SELECT ContractID FROM @ContractIDs);
    
    -- 9. Удаляем отзывы
    DELETE FROM Reviews WHERE ClientUserID = @UserID;
    
    -- 10. Удаляем историю специалистов
    DELETE FROM SpecialistHistory 
    WHERE OrderID IN (SELECT ContractID FROM @ContractIDs)
       OR ApplicationID IN (SELECT ApplicationID FROM @ApplicationIDs)
       OR ClientID = @UserID;
    
    -- 11. Удаляем договоры
    DELETE FROM Contracts WHERE ContractID IN (SELECT ContractID FROM @ContractIDs);
    
    -- 12. Удаляем заявки
    DELETE FROM Applications WHERE ClientUserID = @UserID;
    
    -- 13. Удаляем объекты строительства
    DELETE FROM ConstructionObjects WHERE ClientUserID = @UserID;
    
    -- 14. Удаляем push-подписки
    DELETE FROM PushSubscriptions WHERE UserID = @UserID;
    
    -- 15. Удаляем банковские реквизиты компании
    DELETE FROM CompanyBankDetails 
    WHERE CompanyID IN (SELECT CompanyID FROM ClientCompanies WHERE UserID = @UserID);
    
    -- 16. Удаляем компанию клиента (ВАЖНО: сначала компанию)
    DELETE FROM ClientCompanies WHERE UserID = @UserID;
    
    -- 17. Удаляем пользователя (ПОСЛЕ КОМПАНИИ)
    DELETE FROM Users WHERE UserID = @UserID AND Role = 'client';
    
    -- Возвращаем количество удаленных заказов
    SELECT COUNT(*) AS DeletedOrdersCount FROM @ContractIDs;
END
GO
CREATE OR ALTER PROCEDURE sp_Admin_BulkAddWorkRules
    @WorkTypeID INT,
    @RulesJSON NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @AddedCount INT = 0;
    DECLARE @SkippedCount INT = 0;
    
    -- Временная таблица с правилами из JSON
    DECLARE @NewRules TABLE (
        ObjectTypeID INT,
        InclusionRule VARCHAR(20),
        DurationMultiplier DECIMAL(3,1),
        MinDuration INT NULL,
        IsRequired BIT,
        SortOrder SMALLINT
    );
    
    INSERT INTO @NewRules (ObjectTypeID, InclusionRule, DurationMultiplier, MinDuration, IsRequired, SortOrder)
    SELECT 
        JSON_VALUE(value, '$.ObjectTypeID'),
        JSON_VALUE(value, '$.InclusionRule'),
        JSON_VALUE(value, '$.DurationMultiplier'),
        NULLIF(JSON_VALUE(value, '$.MinDuration'), ''),
        JSON_VALUE(value, '$.IsRequired'),
        JSON_VALUE(value, '$.SortOrder')
    FROM OPENJSON(@RulesJSON);
    
    -- Вставляем только те правила, которых ещё нет
    INSERT INTO ObjectTypeWorkRequirements 
        (ObjectTypeID, WorkTypeID, InclusionRule, DurationMultiplier, MinDuration, IsRequired, SortOrder)
    SELECT 
        nr.ObjectTypeID,
        @WorkTypeID,
        nr.InclusionRule,
        nr.DurationMultiplier,
        nr.MinDuration,
        nr.IsRequired,
        nr.SortOrder
    FROM @NewRules nr
    WHERE NOT EXISTS (
        SELECT 1 FROM ObjectTypeWorkRequirements existing
        WHERE existing.ObjectTypeID = nr.ObjectTypeID 
          AND existing.WorkTypeID = @WorkTypeID
    );
    
    SET @AddedCount = @@ROWCOUNT;
    
    -- Подсчитываем пропущенные (дубликаты)
    SELECT @SkippedCount = COUNT(*) FROM @NewRules nr
    WHERE EXISTS (
        SELECT 1 FROM ObjectTypeWorkRequirements existing
        WHERE existing.ObjectTypeID = nr.ObjectTypeID 
          AND existing.WorkTypeID = @WorkTypeID
    );
    
    SELECT @AddedCount AS AddedCount, @SkippedCount AS SkippedCount;
END
GO


IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Applications') AND name = 'ObjectTypeID')
BEGIN
    ALTER TABLE Applications ADD ObjectTypeID INT NULL;
    
    ALTER TABLE Applications ADD CONSTRAINT FK_Applications_ObjectTypes 
        FOREIGN KEY (ObjectTypeID) REFERENCES ObjectTypes(ObjectTypeID);
    
    CREATE INDEX IX_Applications_ObjectTypeID ON Applications(ObjectTypeID);
END
GO

ALTER PROCEDURE sp_CreateApplication
    @GuestName        NVARCHAR(200) = NULL,
    @GuestPhone       NVARCHAR(20)  = NULL,
    @GuestEmail       NVARCHAR(150) = NULL,
    @GuestDescription NVARCHAR(MAX) = NULL,
    @Source           NVARCHAR(50)  = 'site',
    @ObjectTypeID     INT           = NULL,
    @ApplicationID    INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO Applications (GuestName, GuestPhone, GuestEmail, GuestDescription, Status, Source, ObjectTypeID, CreatedAt)
    VALUES (@GuestName, @GuestPhone, @GuestEmail, @GuestDescription, 'Новая', @Source, @ObjectTypeID, GETDATE());
    SET @ApplicationID = SCOPE_IDENTITY();
    RETURN @ApplicationID;
END
GO






ALTER PROCEDURE sp_GetOrderDetails
    @OrderID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Основная информация о заказе
    SELECT 
        c.ContractID AS Id,
        c.ContractNumber AS OrderNumber,
        c.SignDate,
        c.City,
        a.Status,
        a.Notes,
        co.ObjectName,
        co.ObjectAddress,
        co.Description AS ObjectDescription,
        ot.TypeName AS ObjectType,
        c.CreatedAt,
        cc.CompanyID,
        cc.CompanyName,
        cc.UNP,
        cc.OKPO,
        cc.LegalAddress,
        cc.DirectorLastName,
        cc.DirectorFirstName,
        cc.DirectorPatronymic,
        cc.DirectorPosition,
        -- ФИО из таблицы Users (глобальные данные клиента)
        u.Email AS ClientEmail,
        u.Phone AS ClientPhone,
        -- Банковские реквизиты из CompanyBankDetails
        bd.BankName,
        bd.BankAccount,
        bd.BankBIC,
        bd.IsPrimary AS BankIsPrimary,
        -- Общая стоимость
        (SELECT ISNULL(SUM(Quantity * UnitCost), 0) FROM OrderWorks WHERE ContractID = c.ContractID) AS TotalCost
    FROM Contracts c
    INNER JOIN Applications a ON c.ApplicationID = a.ApplicationID
    INNER JOIN ClientCompanies cc ON c.CompanyID = cc.CompanyID    
    LEFT JOIN Users u ON cc.UserID = u.UserID
    LEFT JOIN ConstructionObjects co ON c.ObjectID = co.ObjectID
    LEFT JOIN ObjectTypes ot ON co.ObjectTypeID = ot.ObjectTypeID
    LEFT JOIN CompanyBankDetails bd ON cc.CompanyID = bd.CompanyID AND bd.IsPrimary = 1
    WHERE c.ContractID = @OrderID;
    
    -- Работы по заказу
    SELECT 
        ow.OrderWorkID AS WorkID,
        ow.ContractID,
        ow.WorkTypeID,
        ow.Quantity,
        ow.UnitCost,
        ow.Duration,
        ow.Status,
        ow.Comment,
        ow.ResponsibleUserID,
        wt.WorkName,
        u2.FullName AS ResponsibleName,
        (ow.Quantity * ow.UnitCost) AS TotalCost
    FROM OrderWorks ow
    LEFT JOIN WorkTypes wt ON ow.WorkTypeID = wt.WorkTypeID
    LEFT JOIN Users u2 ON ow.ResponsibleUserID = u2.UserID
    WHERE ow.ContractID = @OrderID
    ORDER BY ow.OrderWorkID;
    
    -- Детали договора
    SELECT 
        StartDate,
        EndDate,
        CostWithoutVAT,
        VATRate,
        VATAmount,
        VATAmountWords,
        TotalCostWords,
        PaymentSchedule
    FROM ContractDetails
    WHERE ContractID = @OrderID;
END
GO
