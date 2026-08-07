namespace RALabs.Domain.Enums;

public enum UserRole
{
    Anonymous = 0,
    Customer = 1,
    Admin = 2
}

public enum ProjectStatus
{
    InBuild = 0,
    Live = 1
}

public enum LeadStatus
{
    New = 0,
    Contacted = 1,
    Converted = 2,
    Closed = 3
}

public enum LeadSource
{
    Form = 0,
    Chatbot = 1
}

public enum ChatThreadType
{
    Lead = 0,
    CustomerProject = 1
}

public enum ChatSenderType
{
    Visitor = 0,
    Customer = 1,
    Admin = 2,
    Agent = 3
}

public enum AgentTaskStatus
{
    Pending = 0,
    Running = 1,
    Completed = 2,
    Failed = 3
}

public enum KnowledgeSourceType
{
    PublicContent = 0,
    CustomerDocument = 1,
    ThreadMessage = 2
}

public enum CustomerProjectStatus
{
    Intake = 0,
    PrdDraft = 1,
    PrdSigned = 2,
    InBuild = 3,
    Demo = 4,
    Delivered = 5,
    Closed = 6
}

public enum InvoiceStatus
{
    Unpaid = 0,
    PaidCash = 1
}

public enum ClientPrdStatus
{
    Draft = 0,
    Signed = 1
}
