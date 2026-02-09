terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "test-rg"
  location = "East US"

  tags = {
    Environment = "test"
  }
}

# Virtual Network
resource "azurerm_virtual_network" "main" {
  name                = "test-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  tags = {
    Name = "test-vnet"
  }
}

# Subnet
resource "azurerm_subnet" "public" {
  name                 = "test-public-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.1.0/24"]
}

# Network Security Group
resource "azurerm_network_security_group" "web" {
  name                = "test-web-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  security_rule {
    name                       = "HTTP"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HTTPS"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = {
    Name = "test-web-nsg"
  }
}

# Public IP
resource "azurerm_public_ip" "web" {
  name                = "test-web-pip"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"

  tags = {
    Name = "test-web-pip"
  }
}

# Network Interface
resource "azurerm_network_interface" "web" {
  name                = "test-web-nic"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.public.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.web.id
  }
}

# Virtual Machine
resource "azurerm_virtual_machine" "web" {
  name                  = "test-web-vm"
  location              = azurerm_resource_group.main.location
  resource_group_name   = azurerm_resource_group.main.name
  network_interface_ids = [azurerm_network_interface.web.id]
  vm_size               = "Standard_B1s"

  storage_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  storage_os_disk {
    name              = "test-web-osdisk"
    caching           = "ReadWrite"
    create_option     = "FromImage"
    managed_disk_type = "Standard_LRS"
  }

  os_profile {
    computer_name  = "test-web-vm"
    admin_username = "adminuser"
    admin_password = "TestPass123!" # In production, use Azure Key Vault
  }

  os_profile_linux_config {
    disable_password_authentication = false
  }

  tags = {
    Name = "test-web-vm"
  }
}

# SQL Database
resource "azurerm_sql_server" "main" {
  name                         = "test-sql-server"
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = "sqladmin"
  administrator_login_password = "TestPass123!" # In production, use Azure Key Vault

  tags = {
    Name = "test-sql-server"
  }
}

resource "azurerm_sql_database" "main" {
  name                = "test-db"
  resource_group_name = azurerm_resource_group.main.name
  server_name         = azurerm_sql_server.main.name
  edition             = "Basic"

  tags = {
    Name = "test-db"
  }
}

# Storage Account
resource "azurerm_storage_account" "main" {
  name                     = "teststorage${random_id.storage_suffix.hex}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = {
    Name = "test-storage-account"
  }
}

resource "random_id" "storage_suffix" {
  byte_length = 4
}


