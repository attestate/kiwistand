#!/bin/bash
# SSH Tunnel Server Setup Script for 65.108.82.10

# 1. Backup current sshd_config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# 2. Configure SSH for port forwarding
# Enable GatewayPorts (allows external access to forwarded ports)
if grep -q "^GatewayPorts" /etc/ssh/sshd_config; then
    sed -i 's/^GatewayPorts.*/GatewayPorts yes/' /etc/ssh/sshd_config
else
    echo "GatewayPorts yes" >> /etc/ssh/sshd_config
fi

# Enable TCP forwarding
if grep -q "^AllowTcpForwarding" /etc/ssh/sshd_config; then
    sed -i 's/^AllowTcpForwarding.*/AllowTcpForwarding yes/' /etc/ssh/sshd_config
else
    echo "AllowTcpForwarding yes" >> /etc/ssh/sshd_config
fi

# Configure keep-alive settings
if grep -q "^ClientAliveInterval" /etc/ssh/sshd_config; then
    sed -i 's/^ClientAliveInterval.*/ClientAliveInterval 60/' /etc/ssh/sshd_config
else
    echo "ClientAliveInterval 60" >> /etc/ssh/sshd_config
fi

if grep -q "^ClientAliveCountMax" /etc/ssh/sshd_config; then
    sed -i 's/^ClientAliveCountMax.*/ClientAliveCountMax 3/' /etc/ssh/sshd_config
else
    echo "ClientAliveCountMax 3" >> /etc/ssh/sshd_config
fi

# 3. Restart SSH service
systemctl restart sshd

# 4. Configure firewall (ufw - adjust if using different firewall)
if command -v ufw &> /dev/null; then
    echo "Configuring UFW firewall..."
    ufw allow 22/tcp
    ufw allow 443/tcp
    ufw allow 8443/tcp
    ufw allow 5173/tcp
    echo "Firewall rules added. Enable with: ufw enable"
elif command -v firewall-cmd &> /dev/null; then
    echo "Configuring firewalld..."
    firewall-cmd --permanent --add-port=22/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --permanent --add-port=8443/tcp
    firewall-cmd --permanent --add-port=5173/tcp
    firewall-cmd --reload
else
    echo "No recognized firewall found. Manually ensure ports 22, 443, 8443, 5173 are open."
fi

# 5. Verify configuration
echo ""
echo "=== SSH Configuration Verification ==="
grep -E "GatewayPorts|AllowTcpForwarding|ClientAliveInterval|ClientAliveCountMax" /etc/ssh/sshd_config
echo ""
echo "=== SSH Service Status ==="
systemctl status sshd --no-pager -l
echo ""
echo "Setup complete!"
